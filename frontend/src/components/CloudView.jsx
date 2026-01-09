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
const CELL_WIDTH = 56   // 48px card + 8px gap
const CELL_HEIGHT = 64  // 56px card + 8px gap
const BOX_PADDING = 1   // 1 cell padding inside box (for header)
const BOX_GAP = 1       // 1 cell gap between boxes
const MAX_CANVAS_WIDTH = 24  // Max cells wide for initial packing

// Subcategory ordering for auto-placement
const SUBCATEGORY_ORDER = {
  clothing: ['hats', 'tops', 'outerwear', 'bottoms', 'shoes', 'socks', 'underwear', 'accessories', 'other'],
  jewelry: ['necklaces', 'earrings', 'bracelets', 'rings', 'other'],
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

function shelfPackBoxes(categories, itemCounts) {
  const boxes = []

  // Calculate sizes and sort by height (tallest first)
  const categoryData = categories.map(cat => ({
    name: cat.name,
    displayName: cat.displayName,
    ...calculateMinBoxSize(itemCounts[cat.name] || 0)
  })).sort((a, b) => b.height - a.height)

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

// ============ ITEM AUTO-PLACEMENT WITHIN BOX ============

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
        const packedBoxes = shelfPackBoxes(categoriesToPack, itemCounts)

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
  }, [availableCategories, categories, itemCounts])

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

  // Calculate item positions within each box
  const itemPositions = useMemo(() => {
    const positions = {}

    Object.entries(categoryBoxes).forEach(([catName, box]) => {
      const catItems = itemsByCategory[catName] || []
      const catPositions = autoPlaceItems(catItems, box.boxWidth, box.boxHeight, catName)

      catItems.forEach(item => {
        const localPos = catPositions[item.id] || { col: 0, row: 1 }
        positions[item.id] = {
          x: (box.gridCol + localPos.col) * CELL_WIDTH + CELL_WIDTH / 2,
          y: (box.gridRow + localPos.row) * CELL_HEIGHT + CELL_HEIGHT / 2,
          boxName: catName,
          localCol: localPos.col,
          localRow: localPos.row
        }
      })
    })

    return positions
  }, [categoryBoxes, itemsByCategory])

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
              setItemGhostCell({ col: localCol, row: localRow, boxName: pos.boxName })
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

      // Finish dragging item
      if (draggingItem && itemGhostCell) {
        await saveItemPosition(draggingItem.id, itemGhostCell.col, itemGhostCell.row)
        setDraggingItem(null)
        setItemGhostCell(null)
        return
      }

      dragState.current.isPanning = false
      container.style.cursor = 'grab'
    }

    const handleWheel = (e) => {
      handleZoom(e, e.deltaY < 0)
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
    categoryBoxes, updateTransform, draggingBox, boxGhostPosition, boxDragOffset,
    resizingBox, resizeGhost, draggingItem, itemGhostCell, itemPositions,
    isAdmin, token, items, zoom, saveBoxPosition, saveItemPosition, handleZoom
  ])

  // Handle card click (navigate to item)
  const handleCardClick = useCallback((e, item, isPrivate) => {
    if (draggingItem || draggingBox || resizingBox) return
    if (!dragState.current.isPanning && !isPrivate) {
      e.stopPropagation()
      onNavigate(item.id)
    }
  }, [onNavigate, draggingItem, draggingBox, resizingBox])

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

  // Calculate minimum zoom to fit all content
  const minZoom = useMemo(() => {
    if (canvasBounds.width === 0 || canvasBounds.height === 0) return 0.3
    const zoomX = containerSize.width / canvasBounds.width
    const zoomY = containerSize.height / canvasBounds.height
    // Use the smaller of the two, with a small margin (0.9) and floor at 0.3
    return Math.max(0.3, Math.min(zoomX, zoomY) * 0.9)
  }, [canvasBounds, containerSize])

  // Cursor-centered zoom handler
  const handleZoom = useCallback((e, zoomIn) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Current point in canvas coordinates (before zoom)
    const canvasX = (mouseX - panState.current.x) / zoom
    const canvasY = (mouseY - panState.current.y) / zoom

    // Calculate new zoom
    const delta = zoomIn ? 1.15 : 0.87
    const newZoom = Math.min(2.5, Math.max(minZoom, zoom * delta))

    // Calculate new pan to keep the point under cursor stationary
    const newPanX = mouseX - canvasX * newZoom
    const newPanY = mouseY - canvasY * newZoom

    panState.current.x = newPanX
    panState.current.y = newPanY
    setZoom(newZoom)
  }, [zoom, minZoom])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 cursor-grab select-none"
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(2.5, z * 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(minZoom, z / 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          −
        </button>
        <button
          onClick={() => {
            const fitZoom = Math.max(minZoom, Math.min(1, minZoom * 1.1))
            setZoom(fitZoom)
            panState.current = { x: 0, y: 0 }
            updateTransform()
          }}
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
        {/* Category boxes - only visible for admin */}
        {isAdmin && token && Object.values(categoryBoxes).map(box => {
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
                className="h-6 px-2 flex items-center text-xs font-semibold uppercase tracking-wide cursor-move"
                style={{ color }}
              >
                {box.displayName || box.name}
                <span className="ml-auto text-[10px] opacity-60">
                  {itemsByCategory[box.name]?.length || 0}
                </span>
              </div>

              {/* Resize handle */}
              <div
                data-resize-box={box.name}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, transparent 50%, ${color} 50%)`
                }}
              />
            </div>
          )
        })}

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
        {draggingItem && itemGhostCell && categoryBoxes[itemGhostCell.boxName] && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: (categoryBoxes[itemGhostCell.boxName].gridCol + itemGhostCell.col) * CELL_WIDTH + 4,
              top: (categoryBoxes[itemGhostCell.boxName].gridRow + itemGhostCell.row) * CELL_HEIGHT + 4,
              width: 48,
              height: 56,
              border: '2px dashed #22c55e',
              borderRadius: 4,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              zIndex: 999
            }}
          />
        )}
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
