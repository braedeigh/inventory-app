import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

// Category colors for box borders
const CATEGORY_COLORS = {
  clothing: '#22c55e',
  jewelry: '#eab308',
  electronics: '#3b82f6',
  furniture: '#a855f7',
  kitchenware: '#f97316',
  books: '#78716c',
  bedding: '#ec4899',
  toiletries: '#06b6d4',
  sentimental: '#f43f5e',
  other: '#6b7280',
}

// Grid constants
const CELL_WIDTH = 50   // 48px card + 2px gap
const CELL_HEIGHT = 58  // 56px card + 2px gap
const BOX_PADDING = 1   // 1 cell padding inside box (for header)
const BOX_GAP = 0       // No gap - user controls spacing manually
const MAX_CANVAS_WIDTH = 24  // Max cells wide for initial packing

// Subcategory ordering for auto-placement
const SUBCATEGORY_ORDER = {
  clothing: ['hats', 'tops', 'outerwear', 'bottoms', 'shoes', 'socks', 'underwear', 'accessories', 'other'],
  jewelry: ['necklaces', 'earrings', 'bracelets', 'rings', 'other'],
}

// Cluster constants
const CLUSTER_PADDING = 1  // 1 cell padding inside cluster for header
const CLUSTER_GAP = 0      // No gap - use glow effect for visual separation

// Cluster colors (lighter variants of category colors)
const CLUSTER_COLORS = {
  // Clothing subcategories
  hats: '#86efac',
  tops: '#a7f3d0',
  outerwear: '#6ee7b7',
  bottoms: '#34d399',
  shoes: '#10b981',
  socks: '#059669',
  underwear: '#047857',
  accessories: '#065f46',
  // Jewelry subcategories
  necklaces: '#fde047',
  earrings: '#facc15',
  bracelets: '#eab308',
  rings: '#ca8a04',
  // Default
  other: '#9ca3af',
}

// ============ GRID UTILITIES ============

function cellToPixel(col, row) {
  return {
    x: col * CELL_WIDTH,
    y: row * CELL_HEIGHT
  }
}

function pixelToCell(x, y) {
  return {
    col: Math.floor(x / CELL_WIDTH),
    row: Math.floor(y / CELL_HEIGHT)
  }
}

function snapToCell(x, y) {
  const cell = pixelToCell(x, y)
  return cellToPixel(cell.col, cell.row)
}

// ============ BOX OVERLAP DETECTION ============

function boxesOverlap(box1, box2) {
  // Add BOX_GAP to account for minimum spacing
  return !(
    box1.gridCol + box1.boxWidth + BOX_GAP <= box2.gridCol ||
    box2.gridCol + box2.boxWidth + BOX_GAP <= box1.gridCol ||
    box1.gridRow + box1.boxHeight + BOX_GAP <= box2.gridRow ||
    box2.gridRow + box2.boxHeight + BOX_GAP <= box1.gridRow
  )
}

function canPlaceBox(box, allBoxes, excludeId = null) {
  for (const other of allBoxes) {
    if (other.name === excludeId) continue
    if (boxesOverlap(box, other)) return false
  }
  return true
}

// ============ CLUSTER UTILITIES ============

function calculateClusterSize(itemCount) {
  if (itemCount === 0) return { width: 2, height: 2 }

  // Calculate columns needed (aim for square-ish)
  const cols = Math.max(1, Math.ceil(Math.sqrt(itemCount)))
  const rows = Math.max(1, Math.ceil(itemCount / cols))

  // Add padding for header
  return {
    width: cols + CLUSTER_PADDING,
    height: rows + CLUSTER_PADDING + 1 // +1 for header
  }
}

function clustersOverlap(cluster1, cluster2) {
  // Add CLUSTER_GAP to account for minimum spacing
  return !(
    cluster1.localCol + cluster1.width + CLUSTER_GAP <= cluster2.localCol ||
    cluster2.localCol + cluster2.width + CLUSTER_GAP <= cluster1.localCol ||
    cluster1.localRow + cluster1.height + CLUSTER_GAP <= cluster2.localRow ||
    cluster2.localRow + cluster2.height + CLUSTER_GAP <= cluster1.localRow
  )
}

function canPlaceCluster(cluster, allClusters, parentBox, excludeSubcat = null) {
  // Check bounds within parent box (leaving space for parent header)
  if (cluster.localCol < 0 ||
      cluster.localRow < 1 || // Leave row 0 for parent header
      cluster.localCol + cluster.width > parentBox.boxWidth ||
      cluster.localRow + cluster.height > parentBox.boxHeight) {
    return false
  }

  // Check overlap with other clusters
  for (const other of allClusters) {
    if (other.subcategory === excludeSubcat) continue
    if (clustersOverlap(cluster, other)) return false
  }
  return true
}

function pushClustersAway(movingCluster, allClusters, parentBox, maxDepth = 10) {
  if (maxDepth <= 0) return null // Cascade limit reached

  const updates = []

  for (const other of allClusters) {
    if (other.subcategory === movingCluster.subcategory) continue

    if (clustersOverlap(movingCluster, other)) {
      // Calculate push direction (push right first, then down if needed)
      let pushedCluster = {
        ...other,
        localCol: movingCluster.localCol + movingCluster.width + CLUSTER_GAP
      }

      // If pushed outside parent bounds, try pushing down instead
      if (pushedCluster.localCol + pushedCluster.width > parentBox.boxWidth) {
        pushedCluster = {
          ...other,
          localCol: 0,
          localRow: movingCluster.localRow + movingCluster.height + CLUSTER_GAP
        }
      }

      // If still outside bounds, give up
      if (pushedCluster.localRow + pushedCluster.height > parentBox.boxHeight) {
        return null
      }

      // Recursively push any clusters that this push would overlap
      const cascadeUpdates = pushClustersAway(
        pushedCluster,
        allClusters.filter(c => c.subcategory !== other.subcategory),
        parentBox,
        maxDepth - 1
      )

      if (cascadeUpdates === null) return null // Cascade limit reached

      updates.push(pushedCluster)
      updates.push(...cascadeUpdates)
    }
  }

  return updates
}

// Pack clusters within a category box using shelf-packing
function shelfPackClusters(subcategoryItems, parentBox) {
  const clusters = []

  // Calculate sizes for each subcategory
  const subcatData = Object.entries(subcategoryItems)
    .filter(([, items]) => items.length > 0)
    .map(([subcat, items]) => ({
      subcategory: subcat,
      itemCount: items.length,
      ...calculateClusterSize(items.length)
    }))
    .sort((a, b) => b.height - a.height) // Tallest first

  let currentRow = 1 // Start after parent header
  let currentCol = 0
  let rowHeight = 0
  const availableWidth = parentBox.boxWidth

  for (const subcat of subcatData) {
    // Check if cluster fits on current row
    if (currentCol + subcat.width > availableWidth) {
      // Move to next row
      currentRow += rowHeight + CLUSTER_GAP
      currentCol = 0
      rowHeight = 0
    }

    clusters.push({
      subcategory: subcat.subcategory,
      localCol: currentCol,
      localRow: currentRow,
      width: subcat.width,
      height: subcat.height,
      itemCount: subcat.itemCount
    })

    currentCol += subcat.width + CLUSTER_GAP
    rowHeight = Math.max(rowHeight, subcat.height)
  }

  return clusters
}

// ============ SHELF-PACKING ALGORITHM ============

function calculateMinBoxSize(itemCount) {
  if (itemCount === 0) return { width: 2, height: 2 }

  // Calculate columns needed (aim for wider than tall)
  const cols = Math.max(2, Math.ceil(Math.sqrt(itemCount * 1.5)))
  const rows = Math.max(1, Math.ceil(itemCount / cols))

  // Add padding for header
  return {
    width: cols + BOX_PADDING,
    height: rows + BOX_PADDING + 1 // +1 for header
  }
}

// Calculate box size needed to fit all clusters
function calculateBoxSizeForClusters(subcategoryItems, minWidth = 4) {
  // First calculate what clusters we'd create
  const subcatData = Object.entries(subcategoryItems)
    .filter(([, items]) => items.length > 0)
    .map(([subcat, items]) => ({
      subcategory: subcat,
      itemCount: items.length,
      ...calculateClusterSize(items.length)
    }))
    .sort((a, b) => b.height - a.height) // Tallest first

  if (subcatData.length === 0) return { width: 2, height: 2 }

  // Calculate total cluster area to estimate reasonable width
  const totalWidth = subcatData.reduce((sum, c) => sum + c.width, 0)
  const maxClusterWidth = Math.max(...subcatData.map(c => c.width))

  // Try to fit 2-3 clusters per row for reasonable layout
  // Start with width that could fit at least 2 average-width clusters
  const avgWidth = totalWidth / subcatData.length
  let boxWidth = Math.max(minWidth, maxClusterWidth, Math.ceil(avgWidth * 2))

  // Cap at reasonable max
  boxWidth = Math.min(boxWidth, MAX_CANVAS_WIDTH - 2)

  // Simulate shelf packing to find required height
  let currentRow = 1
  let currentCol = 0
  let rowHeight = 0
  let maxHeight = 0

  for (const subcat of subcatData) {
    if (currentCol + subcat.width > boxWidth) {
      currentRow += rowHeight + CLUSTER_GAP
      currentCol = 0
      rowHeight = 0
    }
    currentCol += subcat.width + CLUSTER_GAP
    rowHeight = Math.max(rowHeight, subcat.height)
    maxHeight = Math.max(maxHeight, currentRow + rowHeight)
  }

  return {
    width: boxWidth,
    height: maxHeight + 1 // +1 for box header
  }
}

function shelfPackBoxes(categories, itemCounts, itemsBySubcategory = null) {
  const boxes = []

  // Calculate sizes and sort by height (tallest first)
  const categoryData = categories.map(cat => {
    // Use cluster-aware sizing if we have subcategory data
    if (itemsBySubcategory && itemsBySubcategory[cat.name]) {
      const subcatItems = itemsBySubcategory[cat.name]
      const hasSubcategories = Object.values(subcatItems).some(items => items.length > 0)
      if (hasSubcategories) {
        return {
          name: cat.name,
          displayName: cat.displayName,
          ...calculateBoxSizeForClusters(subcatItems)
        }
      }
    }
    // Fallback to simple item count sizing
    return {
      name: cat.name,
      displayName: cat.displayName,
      ...calculateMinBoxSize(itemCounts[cat.name] || 0)
    }
  }).sort((a, b) => b.height - a.height)

  let currentRow = 0
  let currentCol = 0
  let rowHeight = 0

  for (const cat of categoryData) {
    // Check if box fits on current row
    if (currentCol + cat.width > MAX_CANVAS_WIDTH) {
      // Move to next row
      currentRow += rowHeight + BOX_GAP
      currentCol = 0
      rowHeight = 0
    }

    boxes.push({
      name: cat.name,
      displayName: cat.displayName,
      gridCol: currentCol,
      gridRow: currentRow,
      boxWidth: cat.width,
      boxHeight: cat.height
    })

    currentCol += cat.width + BOX_GAP
    rowHeight = Math.max(rowHeight, cat.height)
  }

  return boxes
}

// ============ PUSH ALGORITHM FOR OVERLAPS ============

function pushBoxesAway(movingBox, allBoxes, maxDepth = 10) {
  if (maxDepth <= 0) return null // Cascade limit reached

  const updates = []

  for (const other of allBoxes) {
    if (other.name === movingBox.name) continue

    if (boxesOverlap(movingBox, other)) {
      // Calculate push direction (push right)
      const pushedBox = {
        ...other,
        gridCol: movingBox.gridCol + movingBox.boxWidth + BOX_GAP
      }

      // Recursively push any boxes that this push would overlap
      const cascadeUpdates = pushBoxesAway(pushedBox, allBoxes.filter(b => b.name !== other.name), maxDepth - 1)

      if (cascadeUpdates === null) return null // Cascade limit reached

      updates.push(pushedBox)
      updates.push(...cascadeUpdates)
    }
  }

  return updates
}

// ============ ITEM AUTO-PLACEMENT WITHIN CLUSTERS ============

function autoPlaceItemsInCluster(items, cluster) {
  const positions = {}
  const availableWidth = cluster.width - CLUSTER_PADDING
  let currentRow = 1 // Start after cluster header
  let currentCol = 0

  for (const item of items) {
    // If item has manual position within cluster, use it
    if (item.clusterCol != null && item.clusterRow != null) {
      positions[item.id] = { col: item.clusterCol, row: item.clusterRow }
      continue
    }

    // Find next available cell
    while (currentRow < cluster.height) {
      if (currentCol < availableWidth) {
        positions[item.id] = { col: currentCol, row: currentRow }
        currentCol++
        break
      }
      currentCol = 0
      currentRow++
    }
  }

  return positions
}

// Legacy function for backwards compatibility when clusters are disabled
function autoPlaceItems(items, boxWidth, boxHeight, category) {
  const positions = {}
  const order = SUBCATEGORY_ORDER[category] || ['other']

  // Group by subcategory
  const bySubcat = {}
  order.forEach(sub => { bySubcat[sub] = [] })
  bySubcat['_other'] = []

  items.forEach(item => {
    // If item has manual position, use it
    if (item.localCol != null && item.localRow != null) {
      positions[item.id] = { col: item.localCol, row: item.localRow }
      return
    }

    const sub = item.subcategory?.toLowerCase() || '_other'
    if (bySubcat[sub]) {
      bySubcat[sub].push(item)
    } else {
      bySubcat['_other'].push(item)
    }
  })

  // Available cells (excluding header row)
  const availableWidth = boxWidth - BOX_PADDING
  let currentRow = 1 // Start after header
  let currentCol = 0

  // Place items by subcategory order
  const orderedSubcats = [...order, '_other']
  for (const subcat of orderedSubcats) {
    const subcatItems = bySubcat[subcat] || []

    for (const item of subcatItems) {
      // Skip items that already have positions
      if (positions[item.id]) continue

      // Find next available cell
      while (currentRow < boxHeight) {
        if (currentCol < availableWidth) {
          positions[item.id] = { col: currentCol, row: currentRow }
          currentCol++
          break
        }
        currentCol = 0
        currentRow++
      }
    }
  }

  return positions
}

// ============ MAIN COMPONENT ============

function CloudView({
  items,
  filteredItems,
  availableCategories,
  isAdmin,
  onNavigate,
  token,
  onItemUpdate,
  onCategoryUpdate
}) {
  const containerRef = useRef(null)
  const panRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(0.8)

  // Box state (from database or auto-calculated)
  const [categoryBoxes, setCategoryBoxes] = useState({})

  // Drag state for boxes
  const [draggingBox, setDraggingBox] = useState(null)
  const [boxDragOffset, setBoxDragOffset] = useState({ x: 0, y: 0 })
  const [boxGhostPosition, setBoxGhostPosition] = useState(null)

  // Resize state for boxes
  const [resizingBox, setResizingBox] = useState(null)
  const [resizeGhost, setResizeGhost] = useState(null)

  // Item drag state
  const [draggingItem, setDraggingItem] = useState(null)
  const [itemGhostCell, setItemGhostCell] = useState(null)

  // Subcategory cluster state
  const [subcategoryClusters, setSubcategoryClusters] = useState({}) // { categoryName: { subcatName: clusterData } }
  const [savedClusterPositions, setSavedClusterPositions] = useState(null) // Loaded from API
  const [draggingCluster, setDraggingCluster] = useState(null)
  const [clusterDragOffset, setClusterDragOffset] = useState({ x: 0, y: 0 })
  const [clusterGhostPosition, setClusterGhostPosition] = useState(null)

  const panState = useRef({ x: 0, y: 0 })
  const dragState = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })

  // Get unique categories from items
  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category).filter(Boolean))]
    return cats.length > 0 ? cats : ['other']
  }, [items])

  // Count items per category
  const itemCounts = useMemo(() => {
    const counts = {}
    items.forEach(item => {
      const cat = item.category || 'other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [items])

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped = {}
    categories.forEach(cat => { grouped[cat] = [] })
    items.forEach(item => {
      const cat = item.category || 'other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    })
    return grouped
  }, [items, categories])

  // Group items by subcategory within each category
  const itemsBySubcategory = useMemo(() => {
    const grouped = {}
    categories.forEach(cat => {
      grouped[cat] = {}
      const order = SUBCATEGORY_ORDER[cat] || ['other']
      order.forEach(sub => { grouped[cat][sub] = [] })
      grouped[cat]['other'] = []
    })

    items.forEach(item => {
      const cat = item.category || 'other'
      if (!grouped[cat]) grouped[cat] = { other: [] }
      const subcat = item.subcategory?.toLowerCase() || 'other'
      if (!grouped[cat][subcat]) grouped[cat][subcat] = []
      grouped[cat][subcat].push(item)
    })

    return grouped
  }, [items, categories])

  // Initialize category boxes from availableCategories or auto-calculate
  useEffect(() => {
    const boxes = {}
    let needsPacking = false

    // Check which categories have saved positions
    availableCategories.forEach(cat => {
      if (cat.gridCol != null && cat.gridRow != null && cat.boxWidth != null && cat.boxHeight != null) {
        boxes[cat.name] = {
          name: cat.name,
          displayName: cat.displayName,
          gridCol: cat.gridCol,
          gridRow: cat.gridRow,
          boxWidth: cat.boxWidth,
          boxHeight: cat.boxHeight
        }
      } else if (categories.includes(cat.name)) {
        needsPacking = true
      }
    })

    // Also include categories from items that aren't in availableCategories
    categories.forEach(catName => {
      if (!boxes[catName] && !availableCategories.find(c => c.name === catName)) {
        needsPacking = true
      }
    })

    if (needsPacking) {
      // Run shelf-packing for categories without positions
      const categoriesToPack = categories
        .filter(catName => !boxes[catName])
        .map(catName => ({
          name: catName,
          displayName: availableCategories.find(c => c.name === catName)?.displayName || catName
        }))

      if (categoriesToPack.length > 0) {
        const packedBoxes = shelfPackBoxes(categoriesToPack, itemCounts, itemsBySubcategory)

        // Offset packed boxes to not overlap with existing boxes
        let maxRow = 0
        Object.values(boxes).forEach(box => {
          maxRow = Math.max(maxRow, box.gridRow + box.boxHeight + BOX_GAP)
        })

        packedBoxes.forEach(box => {
          boxes[box.name] = {
            ...box,
            gridRow: box.gridRow + maxRow
          }
        })
      }
    }

    setCategoryBoxes(boxes)
  }, [availableCategories, categories, itemCounts, itemsBySubcategory])

  // Fetch saved cluster positions from API
  useEffect(() => {
    const fetchClusterPositions = async () => {
      try {
        const response = await fetch(`${API_URL}/clusters`)
        if (response.ok) {
          const data = await response.json()
          setSavedClusterPositions(data)
        }
      } catch (error) {
        console.error('Failed to fetch cluster positions:', error)
        setSavedClusterPositions({})
      }
    }
    fetchClusterPositions()
  }, [])

  // Initialize subcategory clusters for each category
  useEffect(() => {
    // Wait for saved positions to load
    if (savedClusterPositions === null) return

    const newClusters = {}
    const boxUpdates = {} // Track boxes that need resizing

    Object.entries(categoryBoxes).forEach(([catName, box]) => {
      const subcatItems = itemsBySubcategory[catName] || {}

      // Calculate required box size for clusters
      const requiredSize = calculateBoxSizeForClusters(subcatItems)

      // Check if we have saved cluster positions from API
      const savedCatClusters = savedClusterPositions[catName] || {}
      const existingClusters = subcategoryClusters[catName] || {}
      const hasApiPositions = Object.keys(savedCatClusters).length > 0
      const hasExistingPositions = Object.keys(existingClusters).length > 0

      // Use larger of current box size or required size
      const effectiveBox = {
        ...box,
        boxWidth: Math.max(box.boxWidth, requiredSize.width),
        boxHeight: Math.max(box.boxHeight, requiredSize.height)
      }

      // Track if box needs resizing
      if (effectiveBox.boxWidth > box.boxWidth || effectiveBox.boxHeight > box.boxHeight) {
        boxUpdates[catName] = effectiveBox
      }

      if (hasApiPositions) {
        // Use saved API positions, but update sizes based on item counts
        newClusters[catName] = {}
        Object.entries(subcatItems).forEach(([subcat, subcatItemList]) => {
          if (subcatItemList.length === 0) return

          const saved = savedCatClusters[subcat]
          const size = calculateClusterSize(subcatItemList.length)

          if (saved) {
            // Use saved position, ensure size fits items
            newClusters[catName][subcat] = {
              subcategory: subcat,
              localCol: saved.localCol,
              localRow: saved.localRow,
              width: Math.max(saved.width, size.width),
              height: Math.max(saved.height, size.height),
              itemCount: subcatItemList.length
            }
          } else {
            // New subcategory - pack it
            const packed = shelfPackClusters({ [subcat]: subcatItemList }, effectiveBox)
            if (packed.length > 0) {
              newClusters[catName][subcat] = packed[0]
            }
          }
        })
      } else if (hasExistingPositions) {
        // Use existing in-memory positions, but update sizes based on item counts
        newClusters[catName] = {}
        Object.entries(subcatItems).forEach(([subcat, subcatItemList]) => {
          if (subcatItemList.length === 0) return

          const existing = existingClusters[subcat]
          const size = calculateClusterSize(subcatItemList.length)

          if (existing) {
            // Keep position, update size
            newClusters[catName][subcat] = {
              ...existing,
              width: Math.max(existing.width, size.width),
              height: Math.max(existing.height, size.height),
              itemCount: subcatItemList.length
            }
          } else {
            // New subcategory - pack it
            const existingClustersList = Object.values(newClusters[catName])
            const packed = shelfPackClusters({ [subcat]: subcatItemList }, effectiveBox)
            if (packed.length > 0) {
              newClusters[catName][subcat] = packed[0]
            }
          }
        })
      } else {
        // Auto-pack all clusters
        const packed = shelfPackClusters(subcatItems, effectiveBox)
        newClusters[catName] = {}
        packed.forEach(cluster => {
          newClusters[catName][cluster.subcategory] = cluster
        })
      }
    })

    // Apply box resizing if any boxes need more space
    if (Object.keys(boxUpdates).length > 0) {
      setCategoryBoxes(prev => {
        const updated = { ...prev }
        Object.entries(boxUpdates).forEach(([catName, updatedBox]) => {
          updated[catName] = updatedBox
        })
        return updated
      })
    }

    setSubcategoryClusters(newClusters)
  }, [categoryBoxes, itemsBySubcategory, savedClusterPositions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate item positions within clusters
  const itemPositions = useMemo(() => {
    const positions = {}

    Object.entries(categoryBoxes).forEach(([catName, box]) => {
      const catClusters = subcategoryClusters[catName] || {}
      const subcatItems = itemsBySubcategory[catName] || {}

      // Process items within each cluster
      Object.entries(subcatItems).forEach(([subcat, subcatItemList]) => {
        if (subcatItemList.length === 0) return

        const cluster = catClusters[subcat]
        if (!cluster) {
          // Fallback: place items directly in box if no cluster
          subcatItemList.forEach((item, idx) => {
            const col = idx % (box.boxWidth - BOX_PADDING)
            const row = 1 + Math.floor(idx / (box.boxWidth - BOX_PADDING))
            positions[item.id] = {
              x: (box.gridCol + col) * CELL_WIDTH + CELL_WIDTH / 2,
              y: (box.gridRow + row) * CELL_HEIGHT + CELL_HEIGHT / 2,
              boxName: catName,
              clusterName: null,
              localCol: col,
              localRow: row
            }
          })
          return
        }

        // Place items within cluster
        const clusterPositions = autoPlaceItemsInCluster(subcatItemList, cluster)

        subcatItemList.forEach(item => {
          const localPos = clusterPositions[item.id] || { col: 0, row: 1 }
          // Calculate absolute position: box position + cluster position + item position in cluster
          const absCol = box.gridCol + cluster.localCol + localPos.col
          const absRow = box.gridRow + cluster.localRow + localPos.row

          positions[item.id] = {
            x: absCol * CELL_WIDTH + CELL_WIDTH / 2,
            y: absRow * CELL_HEIGHT + CELL_HEIGHT / 2,
            boxName: catName,
            clusterName: subcat,
            localCol: localPos.col,
            localRow: localPos.row,
            clusterCol: cluster.localCol,
            clusterRow: cluster.localRow
          }
        })
      })
    })

    return positions
  }, [categoryBoxes, subcategoryClusters, itemsBySubcategory])

  const filteredIds = useMemo(() => {
    return new Set(filteredItems.map(item => item.id))
  }, [filteredItems])

  // Container size tracking
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const updateTransform = useCallback(() => {
    if (panRef.current) {
      panRef.current.style.transform = `translate3d(${panState.current.x}px, ${panState.current.y}px, 0) scale(${zoom})`
    }
  }, [zoom])

  useEffect(() => {
    updateTransform()
  }, [zoom, updateTransform])

  // Save category box position to database
  const saveBoxPosition = useCallback(async (categoryName, gridCol, gridRow, boxWidth, boxHeight) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/categories/name/${categoryName}/box`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gridCol, gridRow, boxWidth, boxHeight })
      })

      if (response.ok && onCategoryUpdate) {
        onCategoryUpdate(categoryName, { gridCol, gridRow, boxWidth, boxHeight })
      }
      return response.ok
    } catch (error) {
      console.error('Failed to save box position:', error)
      return false
    }
  }, [token, onCategoryUpdate])

  // Save item position within box
  const saveItemPosition = useCallback(async (itemId, localCol, localRow) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/item/${itemId}/position`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ localCol, localRow })
      })

      if (response.ok && onItemUpdate) {
        onItemUpdate(itemId, { localCol, localRow })
      }
      return response.ok
    } catch (error) {
      console.error('Failed to save item position:', error)
      return false
    }
  }, [token, onItemUpdate])

  // Save cluster position within category box
  const saveClusterPosition = useCallback(async (categoryName, subcategoryName, localCol, localRow, width, height) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/categories/${categoryName}/subcategories/${subcategoryName}/cluster`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ localCol, localRow, width, height })
      })

      return response.ok
    } catch (error) {
      console.error('Failed to save cluster position:', error)
      return false
    }
  }, [token])

  // Update item subcategory when dragged to different cluster
  const updateItemSubcategory = useCallback(async (itemId, newSubcategory) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subcategory: newSubcategory })
      })

      if (response.ok && onItemUpdate) {
        onItemUpdate(itemId, { subcategory: newSubcategory })
      }
      return response.ok
    } catch (error) {
      console.error('Failed to update item subcategory:', error)
      return false
    }
  }, [token, onItemUpdate])

  // ============ EVENT HANDLERS ============

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e) => {
      // Check for resize handle
      const resizeHandle = e.target.closest('[data-resize-box]')
      if (resizeHandle && isAdmin && token) {
        e.preventDefault()
        e.stopPropagation()
        const boxName = resizeHandle.dataset.resizeBox
        const box = categoryBoxes[boxName]
        if (box) {
          setResizingBox(boxName)
          setResizeGhost({ width: box.boxWidth, height: box.boxHeight })
        }
        return
      }

      // Check for cluster header drag
      const clusterHeader = e.target.closest('[data-cluster-header]')
      if (clusterHeader && isAdmin && token) {
        e.preventDefault()
        e.stopPropagation()
        const [catName, subcatName] = clusterHeader.dataset.clusterHeader.split(':')
        const box = categoryBoxes[catName]
        const cluster = subcategoryClusters[catName]?.[subcatName]
        if (box && cluster) {
          const rect = panRef.current.getBoundingClientRect()
          const mouseX = (e.clientX - rect.left) / zoom
          const mouseY = (e.clientY - rect.top) / zoom
          const clusterAbsPixel = cellToPixel(
            box.gridCol + cluster.localCol,
            box.gridRow + cluster.localRow
          )

          setDraggingCluster({ catName, subcatName })
          setClusterDragOffset({
            x: mouseX - clusterAbsPixel.x,
            y: mouseY - clusterAbsPixel.y
          })
          setClusterGhostPosition({ col: cluster.localCol, row: cluster.localRow })
        }
        return
      }

      // Check for box header drag
      const boxHeader = e.target.closest('[data-box-header]')
      if (boxHeader && isAdmin && token) {
        e.preventDefault()
        e.stopPropagation()
        const boxName = boxHeader.dataset.boxHeader
        const box = categoryBoxes[boxName]
        if (box) {
          const rect = panRef.current.getBoundingClientRect()
          const mouseX = (e.clientX - rect.left) / zoom
          const mouseY = (e.clientY - rect.top) / zoom
          const boxPixel = cellToPixel(box.gridCol, box.gridRow)

          setDraggingBox(boxName)
          setBoxDragOffset({
            x: mouseX - boxPixel.x,
            y: mouseY - boxPixel.y
          })
          setBoxGhostPosition({ col: box.gridCol, row: box.gridRow })
        }
        return
      }

      // Check for item card drag
      const card = e.target.closest('[data-item-id]')
      if (card && isAdmin && token) {
        e.preventDefault()
        e.stopPropagation()
        const itemId = card.dataset.itemId
        const item = items.find(i => i.id === itemId)
        if (item) {
          const pos = itemPositions[item.id]
          if (pos) {
            setDraggingItem(item)
            setItemGhostCell({ col: pos.localCol, row: pos.localRow, boxName: pos.boxName })
          }
        }
        return
      }

      // Otherwise pan
      dragState.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panState.current.x,
        startPanY: panState.current.y
      }
      container.style.cursor = 'grabbing'
    }

    const handleMouseMove = (e) => {
      const rect = panRef.current.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) / zoom
      const mouseY = (e.clientY - rect.top) / zoom

      // Resizing box
      if (resizingBox) {
        const box = categoryBoxes[resizingBox]
        if (box) {
          const cell = pixelToCell(mouseX, mouseY)
          const newWidth = Math.max(2, cell.col - box.gridCol + 1)
          const newHeight = Math.max(2, cell.row - box.gridRow + 1)
          setResizeGhost({ width: newWidth, height: newHeight })
        }
        return
      }

      // Dragging box
      if (draggingBox) {
        const targetX = mouseX - boxDragOffset.x
        const targetY = mouseY - boxDragOffset.y
        const snapped = pixelToCell(targetX, targetY)
        setBoxGhostPosition({ col: Math.max(0, snapped.col), row: Math.max(0, snapped.row) })
        return
      }

      // Dragging cluster
      if (draggingCluster) {
        const box = categoryBoxes[draggingCluster.catName]
        if (box) {
          const targetX = mouseX - clusterDragOffset.x
          const targetY = mouseY - clusterDragOffset.y
          const cell = pixelToCell(targetX, targetY)
          // Convert to local coordinates within the box
          const localCol = cell.col - box.gridCol
          const localRow = cell.row - box.gridRow

          // Constrain within parent bounds
          const cluster = subcategoryClusters[draggingCluster.catName]?.[draggingCluster.subcatName]
          if (cluster) {
            const maxCol = box.boxWidth - cluster.width
            const maxRow = box.boxHeight - cluster.height
            setClusterGhostPosition({
              col: Math.max(0, Math.min(maxCol, localCol)),
              row: Math.max(1, Math.min(maxRow, localRow)) // min row 1 for parent header
            })
          }
        }
        return
      }

      // Dragging item
      if (draggingItem) {
        const pos = itemPositions[draggingItem.id]
        if (pos) {
          const box = categoryBoxes[pos.boxName]
          if (box) {
            const cell = pixelToCell(mouseX, mouseY)
            const localCol = cell.col - box.gridCol
            const localRow = cell.row - box.gridRow

            // Constrain to box bounds
            if (localCol >= 0 && localCol < box.boxWidth && localRow >= 1 && localRow < box.boxHeight) {
              // Check which cluster the mouse is over
              const catClusters = subcategoryClusters[pos.boxName] || {}
              let targetCluster = null

              for (const [subcatName, cluster] of Object.entries(catClusters)) {
                if (localCol >= cluster.localCol &&
                    localCol < cluster.localCol + cluster.width &&
                    localRow >= cluster.localRow &&
                    localRow < cluster.localRow + cluster.height) {
                  targetCluster = subcatName
                  break
                }
              }

              // Calculate position within target cluster
              if (targetCluster && catClusters[targetCluster]) {
                const cluster = catClusters[targetCluster]
                const clusterCol = localCol - cluster.localCol
                const clusterRow = localRow - cluster.localRow
                setItemGhostCell({
                  col: clusterCol,
                  row: clusterRow,
                  boxName: pos.boxName,
                  clusterName: targetCluster,
                  clusterLocalCol: cluster.localCol,
                  clusterLocalRow: cluster.localRow
                })
              } else {
                // No cluster under mouse - show in box coords
                setItemGhostCell({ col: localCol, row: localRow, boxName: pos.boxName, clusterName: null })
              }
            }
          }
        }
        return
      }

      // Panning
      if (!dragState.current.isPanning) return
      panState.current.x = dragState.current.startPanX + (e.clientX - dragState.current.startX)
      panState.current.y = dragState.current.startPanY + (e.clientY - dragState.current.startY)
      updateTransform()
    }

    const handleMouseUp = async () => {
      // Finish resizing
      if (resizingBox && resizeGhost) {
        const box = categoryBoxes[resizingBox]
        if (box) {
          const newBox = {
            ...box,
            boxWidth: resizeGhost.width,
            boxHeight: resizeGhost.height
          }

          // Check for overlaps and push
          const otherBoxes = Object.values(categoryBoxes).filter(b => b.name !== resizingBox)
          const canPlace = canPlaceBox(newBox, otherBoxes)

          if (canPlace) {
            setCategoryBoxes(prev => ({ ...prev, [resizingBox]: newBox }))
            await saveBoxPosition(resizingBox, box.gridCol, box.gridRow, resizeGhost.width, resizeGhost.height)
          } else {
            // Try push algorithm
            const pushUpdates = pushBoxesAway(newBox, otherBoxes)
            if (pushUpdates) {
              const updatedBoxes = { ...categoryBoxes, [resizingBox]: newBox }
              for (const pushed of pushUpdates) {
                updatedBoxes[pushed.name] = pushed
                await saveBoxPosition(pushed.name, pushed.gridCol, pushed.gridRow, pushed.boxWidth, pushed.boxHeight)
              }
              setCategoryBoxes(updatedBoxes)
              await saveBoxPosition(resizingBox, box.gridCol, box.gridRow, resizeGhost.width, resizeGhost.height)
            }
          }
        }
        setResizingBox(null)
        setResizeGhost(null)
        return
      }

      // Finish dragging box
      if (draggingBox && boxGhostPosition) {
        const box = categoryBoxes[draggingBox]
        if (box) {
          const newBox = {
            ...box,
            gridCol: boxGhostPosition.col,
            gridRow: boxGhostPosition.row
          }

          // Check for overlaps
          const otherBoxes = Object.values(categoryBoxes).filter(b => b.name !== draggingBox)
          if (canPlaceBox(newBox, otherBoxes)) {
            setCategoryBoxes(prev => ({ ...prev, [draggingBox]: newBox }))
            await saveBoxPosition(draggingBox, boxGhostPosition.col, boxGhostPosition.row, box.boxWidth, box.boxHeight)
          }
        }
        setDraggingBox(null)
        setBoxGhostPosition(null)
        return
      }

      // Finish dragging cluster
      if (draggingCluster && clusterGhostPosition) {
        const { catName, subcatName } = draggingCluster
        const box = categoryBoxes[catName]
        const cluster = subcategoryClusters[catName]?.[subcatName]

        if (box && cluster) {
          const newCluster = {
            ...cluster,
            localCol: clusterGhostPosition.col,
            localRow: clusterGhostPosition.row
          }

          // Check for overlaps with other clusters
          const otherClusters = Object.values(subcategoryClusters[catName] || {})
            .filter(c => c.subcategory !== subcatName)

          if (canPlaceCluster(newCluster, otherClusters, box, subcatName)) {
            setSubcategoryClusters(prev => ({
              ...prev,
              [catName]: {
                ...prev[catName],
                [subcatName]: newCluster
              }
            }))
            // Save cluster position (will add API call later)
            await saveClusterPosition(catName, subcatName, clusterGhostPosition.col, clusterGhostPosition.row, cluster.width, cluster.height)
          } else {
            // Try push algorithm
            const pushUpdates = pushClustersAway(newCluster, otherClusters, box)
            if (pushUpdates) {
              const updatedClusters = { ...subcategoryClusters[catName], [subcatName]: newCluster }
              for (const pushed of pushUpdates) {
                updatedClusters[pushed.subcategory] = pushed
                await saveClusterPosition(catName, pushed.subcategory, pushed.localCol, pushed.localRow, pushed.width, pushed.height)
              }
              setSubcategoryClusters(prev => ({
                ...prev,
                [catName]: updatedClusters
              }))
              await saveClusterPosition(catName, subcatName, clusterGhostPosition.col, clusterGhostPosition.row, cluster.width, cluster.height)
            }
          }
        }
        setDraggingCluster(null)
        setClusterGhostPosition(null)
        return
      }

      // Finish dragging item
      if (draggingItem && itemGhostCell) {
        const currentSubcat = draggingItem.subcategory?.toLowerCase() || 'other'
        const targetSubcat = itemGhostCell.clusterName

        // If dropped on a different cluster, update subcategory
        if (targetSubcat && targetSubcat !== currentSubcat) {
          await updateItemSubcategory(draggingItem.id, targetSubcat)
        }

        // Save position (col/row are now cluster-relative)
        await saveItemPosition(draggingItem.id, itemGhostCell.col, itemGhostCell.row)
        setDraggingItem(null)
        setItemGhostCell(null)
        return
      }

      dragState.current.isPanning = false
      container.style.cursor = 'grab'
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(2, Math.max(0.2, zoom * delta))

      // Get mouse position relative to container
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Calculate the point on the canvas under the mouse (before zoom)
      const canvasX = (mouseX - panState.current.x) / zoom
      const canvasY = (mouseY - panState.current.y) / zoom

      // Calculate new pan position to keep mouse over same canvas point
      panState.current.x = mouseX - canvasX * newZoom
      panState.current.y = mouseY - canvasY * newZoom

      setZoom(newZoom)
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    categoryBoxes, subcategoryClusters, updateTransform,
    draggingBox, boxGhostPosition, boxDragOffset,
    draggingCluster, clusterGhostPosition, clusterDragOffset,
    resizingBox, resizeGhost, draggingItem, itemGhostCell, itemPositions,
    isAdmin, token, items, zoom,
    saveBoxPosition, saveItemPosition, saveClusterPosition, updateItemSubcategory
  ])

  // Handle card click (navigate to item)
  const handleCardClick = useCallback((e, item, isPrivate) => {
    if (draggingItem || draggingBox || resizingBox || draggingCluster) return
    if (!dragState.current.isPanning && !isPrivate) {
      e.stopPropagation()
      onNavigate(item.id)
    }
  }, [onNavigate, draggingItem, draggingBox, resizingBox, draggingCluster])

  // Calculate canvas bounds
  const canvasBounds = useMemo(() => {
    let maxCol = 10
    let maxRow = 10

    Object.values(categoryBoxes).forEach(box => {
      maxCol = Math.max(maxCol, box.gridCol + box.boxWidth + 2)
      maxRow = Math.max(maxRow, box.gridRow + box.boxHeight + 2)
    })

    return {
      width: maxCol * CELL_WIDTH,
      height: maxRow * CELL_HEIGHT
    }
  }, [categoryBoxes])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 cursor-grab select-none"
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(2, z * 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(0.8); panState.current = { x: 0, y: 0 }; updateTransform() }}
          className="px-2 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Reset
        </button>
      </div>

      {/* Pannable/zoomable container */}
      <div
        ref={panRef}
        style={{
          position: 'absolute',
          width: canvasBounds.width,
          height: canvasBounds.height,
          willChange: 'transform',
          transformOrigin: '0 0',
          transform: 'translate3d(0, 0, 0) scale(0.8)'
        }}
      >
        {/* Category boxes */}
        {Object.values(categoryBoxes).map(box => {
          const pixel = cellToPixel(box.gridCol, box.gridRow)
          const width = box.boxWidth * CELL_WIDTH
          const height = box.boxHeight * CELL_HEIGHT
          const color = CATEGORY_COLORS[box.name] || CATEGORY_COLORS.other
          const isDragging = draggingBox === box.name
          const isResizing = resizingBox === box.name

          return (
            <div
              key={box.name}
              className={`absolute rounded-lg border-2 ${isDragging || isResizing ? 'opacity-50' : ''}`}
              style={{
                left: pixel.x,
                top: pixel.y,
                width: isResizing && resizeGhost ? resizeGhost.width * CELL_WIDTH : width,
                height: isResizing && resizeGhost ? resizeGhost.height * CELL_HEIGHT : height,
                borderColor: color,
                backgroundColor: `${color}10`,
                transition: isDragging || isResizing ? 'none' : 'all 0.2s'
              }}
            >
              {/* Box header (draggable) */}
              <div
                data-box-header={box.name}
                className={`h-6 px-2 flex items-center text-xs font-semibold uppercase tracking-wide ${isAdmin && token ? 'cursor-move' : ''}`}
                style={{ color }}
              >
                {box.displayName || box.name}
                <span className="ml-auto text-[10px] opacity-60">
                  {itemsByCategory[box.name]?.length || 0}
                </span>
              </div>

              {/* Resize handle (admin only) */}
              {isAdmin && token && (
                <div
                  data-resize-box={box.name}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(135deg, transparent 50%, ${color} 50%)`
                  }}
                />
              )}
            </div>
          )
        })}

        {/* Subcategory clusters within boxes */}
        {Object.entries(categoryBoxes).map(([catName, box]) => {
          const catClusters = subcategoryClusters[catName] || {}
          const boxPixel = cellToPixel(box.gridCol, box.gridRow)
          const catColor = CATEGORY_COLORS[catName] || CATEGORY_COLORS.other

          return Object.entries(catClusters).map(([subcatName, cluster]) => {
            const clusterPixel = {
              x: boxPixel.x + cluster.localCol * CELL_WIDTH,
              y: boxPixel.y + cluster.localRow * CELL_HEIGHT
            }
            const clusterWidth = cluster.width * CELL_WIDTH
            const clusterHeight = cluster.height * CELL_HEIGHT
            const clusterColor = CLUSTER_COLORS[subcatName] || catColor
            const isDraggingCluster = draggingCluster?.catName === catName && draggingCluster?.subcatName === subcatName

            return (
              <div
                key={`cluster-${catName}-${subcatName}`}
                data-cluster-header={`${catName}:${subcatName}`}
                className={`absolute rounded-md ${isDraggingCluster ? 'opacity-50' : ''}`}
                style={{
                  left: clusterPixel.x,
                  top: clusterPixel.y,
                  width: clusterWidth,
                  height: clusterHeight,
                  border: `1.5px solid ${clusterColor}`,
                  backgroundColor: `${clusterColor}08`,
                  boxShadow: `0 0 8px ${clusterColor}40, inset 0 0 12px ${clusterColor}15`,
                  zIndex: 5,
                  transition: isDraggingCluster ? 'none' : 'all 0.2s'
                }}
              >
                {/* Cluster header (draggable for admin) */}
                <div
                  className={`h-4 px-1 flex items-center text-[9px] font-medium capitalize ${isAdmin && token ? 'cursor-move' : ''}`}
                  style={{ color: clusterColor }}
                >
                  {subcatName}
                  <span className="ml-auto text-[8px] opacity-60">
                    {cluster.itemCount || 0}
                  </span>
                </div>
              </div>
            )
          })
        })}

        {/* Ghost for cluster dragging */}
        {draggingCluster && clusterGhostPosition && categoryBoxes[draggingCluster.catName] && (
          <div
            className="absolute border-2 border-dashed rounded pointer-events-none"
            style={{
              left: (categoryBoxes[draggingCluster.catName].gridCol + clusterGhostPosition.col) * CELL_WIDTH,
              top: (categoryBoxes[draggingCluster.catName].gridRow + clusterGhostPosition.row) * CELL_HEIGHT,
              width: subcategoryClusters[draggingCluster.catName]?.[draggingCluster.subcatName]?.width * CELL_WIDTH,
              height: subcategoryClusters[draggingCluster.catName]?.[draggingCluster.subcatName]?.height * CELL_HEIGHT,
              borderColor: CLUSTER_COLORS[draggingCluster.subcatName] || '#9ca3af',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              zIndex: 1001
            }}
          />
        )}

        {/* Ghost for box dragging */}
        {draggingBox && boxGhostPosition && (
          <div
            className="absolute border-2 border-dashed rounded-lg pointer-events-none"
            style={{
              left: boxGhostPosition.col * CELL_WIDTH,
              top: boxGhostPosition.row * CELL_HEIGHT,
              width: categoryBoxes[draggingBox]?.boxWidth * CELL_WIDTH,
              height: categoryBoxes[draggingBox]?.boxHeight * CELL_HEIGHT,
              borderColor: CATEGORY_COLORS[draggingBox] || CATEGORY_COLORS.other,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              zIndex: 1000
            }}
          />
        )}

        {/* Item cards */}
        {items.map(item => {
          const position = itemPositions[item.id]
          if (!position) return null

          const isFiltered = filteredIds.has(item.id)
          const isMatching = filteredItems.length === items.length || isFiltered
          const isPrivate = (item.private === 'true' || item.private === true) && !isAdmin
          const shouldBlurPhoto = ((item.private === 'true' || item.private === true) ||
                                   (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
          const isDragging = draggingItem?.id === item.id

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              className={`absolute ${isAdmin && token ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                left: position.x - 24,
                top: position.y - 28,
                width: 48,
                height: 56,
                opacity: isDragging ? 0.5 : (isMatching ? 1 : 0.2),
                transform: `scale(${isMatching ? 1 : 0.8})`,
                zIndex: isDragging ? 1000 : (isMatching ? 10 : 1),
                transition: isDragging ? 'none' : 'opacity 0.15s, transform 0.15s'
              }}
              onClick={(e) => handleCardClick(e, item, isPrivate)}
            >
              <div
                className={`w-full h-full rounded overflow-hidden bg-white dark:bg-neutral-800 shadow-sm border-2 ${isPrivate ? 'opacity-50' : ''}`}
                style={{
                  borderColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other
                }}
              >
                <div className="w-full h-8 bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  {item.mainPhoto ? (
                    <img
                      src={item.mainPhoto}
                      alt={item.itemName}
                      className={`w-full h-full object-cover ${shouldBlurPhoto ? 'blur-md' : ''}`}
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-[8px]">
                      —
                    </div>
                  )}
                </div>
                <div className={`px-0.5 py-0.5 text-[7px] leading-tight text-center truncate ${isPrivate ? 'blur-sm' : ''}`}>
                  {isPrivate ? '•••' : item.itemName}
                </div>
              </div>
            </div>
          )
        })}

        {/* Ghost for item dragging */}
        {draggingItem && itemGhostCell && categoryBoxes[itemGhostCell.boxName] && (() => {
          const box = categoryBoxes[itemGhostCell.boxName]
          let ghostLeft, ghostTop
          let ghostColor = '#22c55e'

          if (itemGhostCell.clusterName && itemGhostCell.clusterLocalCol != null) {
            // Item is over a cluster - position relative to cluster
            ghostLeft = (box.gridCol + itemGhostCell.clusterLocalCol + itemGhostCell.col) * CELL_WIDTH + 4
            ghostTop = (box.gridRow + itemGhostCell.clusterLocalRow + itemGhostCell.row) * CELL_HEIGHT + 4
            ghostColor = CLUSTER_COLORS[itemGhostCell.clusterName] || '#22c55e'
          } else {
            // Item is over box but not a specific cluster
            ghostLeft = (box.gridCol + itemGhostCell.col) * CELL_WIDTH + 4
            ghostTop = (box.gridRow + itemGhostCell.row) * CELL_HEIGHT + 4
          }

          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: ghostLeft,
                top: ghostTop,
                width: 48,
                height: 56,
                border: `2px dashed ${ghostColor}`,
                borderRadius: 4,
                backgroundColor: `${ghostColor}20`,
                zIndex: 999
              }}
            />
          )
        })()}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 text-xs text-neutral-400 pointer-events-none">
        {isAdmin && token
          ? 'Drag boxes to move • Drag corners to resize • Drag items to reposition'
          : 'Drag to pan • Scroll to zoom • Click card to view'
        }
      </div>

      {/* Item count & zoom level */}
      <div className="absolute bottom-3 right-3 text-xs text-neutral-400 pointer-events-none">
        {filteredItems.length}/{items.length} • {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

export default CloudView
