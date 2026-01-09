import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

const CATEGORY_COLORS = {
  clothing: '#22c55e',
  jewelry: '#eab308',
  electronics: '#3b82f6',
  furniture: '#a855f7',
  kitchenware: '#f97316',
  books: '#78716c',
  bedding: '#ec4899',
  toiletries: '#06b6d4',
  other: '#6b7280',
}

// Card dimensions
const CARD_WIDTH = 48
const CARD_HEIGHT = 56
const CARD_GAP = 8
const LABEL_PADDING = 20 // Padding above topmost card for label

// Subcategory layout configuration
// Defines vertical order within each category (top to bottom)
const SUBCATEGORY_LAYOUT = {
  clothing: {
    order: ['hats', 'tops', 'outerwear', 'bottoms', 'shoes', 'accessories'],
    direction: 'vertical'
  },
  jewelry: {
    order: ['necklaces', 'earrings', 'bracelets', 'rings', 'other'],
    direction: 'vertical'
  },
  // Add more category layouts as needed
}

// Default fallback for categories without explicit layout
const DEFAULT_SUBCATEGORY_ORDER = ['other']

// Get subcategory order for a category
function getSubcategoryOrder(category) {
  return SUBCATEGORY_LAYOUT[category]?.order || DEFAULT_SUBCATEGORY_ORDER
}

// Calculate positions with subcategory stratification
function getStratifiedPositions(items, categories, containerWidth, containerHeight, pinnedPositions = {}) {
  const positions = {}
  const clusterBounds = {} // Track bounds for each category for label positioning

  // Group items by category
  const itemsByCategory = {}
  categories.forEach(cat => { itemsByCategory[cat] = [] })
  items.forEach(item => {
    const cat = item.category || 'other'
    if (itemsByCategory[cat]) {
      itemsByCategory[cat].push(item)
    } else {
      itemsByCategory['other'] = itemsByCategory['other'] || []
      itemsByCategory['other'].push(item)
    }
  })

  // Calculate cluster centers in a circle
  const numCategories = categories.length
  const centerX = containerWidth / 2
  const centerY = containerHeight / 2
  const radius = Math.min(containerWidth, containerHeight) * 0.35

  categories.forEach((cat, catIndex) => {
    const angle = (catIndex / numCategories) * 2 * Math.PI - Math.PI / 2
    const clusterCenterX = centerX + radius * Math.cos(angle)
    const clusterCenterY = centerY + radius * Math.sin(angle)

    const catItems = itemsByCategory[cat] || []

    // Separate pinned and unpinned items
    const pinnedItems = catItems.filter(item => pinnedPositions[item.id])
    const unpinnedItems = catItems.filter(item => !pinnedPositions[item.id])

    // Group unpinned items by subcategory
    const subcategoryOrder = getSubcategoryOrder(cat)
    const itemsBySubcat = {}
    subcategoryOrder.forEach(sub => { itemsBySubcat[sub] = [] })
    itemsBySubcat['_other'] = [] // For items with unknown subcategory

    unpinnedItems.forEach(item => {
      const subcat = item.subcategory?.toLowerCase() || '_other'
      if (itemsBySubcat[subcat]) {
        itemsBySubcat[subcat].push(item)
      } else {
        itemsBySubcat['_other'].push(item)
      }
    })

    // Calculate total rows needed
    let totalRows = 0
    const subcatRows = {}
    const orderedSubcats = [...subcategoryOrder, '_other']

    orderedSubcats.forEach(subcat => {
      const subcatItems = itemsBySubcat[subcat] || []
      if (subcatItems.length > 0) {
        const cols = Math.ceil(Math.sqrt(subcatItems.length * 2)) // Wider than tall
        const rows = Math.ceil(subcatItems.length / cols)
        subcatRows[subcat] = { items: subcatItems, cols, rows, startRow: totalRows }
        totalRows += rows
      }
    })

    // Calculate grid dimensions
    const maxCols = Math.max(...Object.values(subcatRows).map(s => s.cols), 1)
    const gridWidth = maxCols * (CARD_WIDTH + CARD_GAP)
    const gridHeight = totalRows * (CARD_HEIGHT + CARD_GAP)
    const startX = clusterCenterX - gridWidth / 2
    const startY = clusterCenterY - gridHeight / 2

    // Initialize bounds tracking
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity

    // Position unpinned items in subcategory rows
    Object.entries(subcatRows).forEach(([subcat, { items: subcatItems, cols, startRow }]) => {
      subcatItems.forEach((item, i) => {
        const col = i % cols
        const row = startRow + Math.floor(i / cols)
        const x = startX + col * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2
        const y = startY + row * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2

        positions[item.id] = { x, y, category: cat, subcategory: subcat }

        // Update bounds
        minX = Math.min(minX, x - CARD_WIDTH / 2)
        maxX = Math.max(maxX, x + CARD_WIDTH / 2)
        minY = Math.min(minY, y - CARD_HEIGHT / 2)
        maxY = Math.max(maxY, y + CARD_HEIGHT / 2)
      })
    })

    // Position pinned items at their saved positions
    pinnedItems.forEach(item => {
      const pinned = pinnedPositions[item.id]
      positions[item.id] = {
        x: pinned.x,
        y: pinned.y,
        category: cat,
        isPinned: true
      }

      // Update bounds
      minX = Math.min(minX, pinned.x - CARD_WIDTH / 2)
      maxX = Math.max(maxX, pinned.x + CARD_WIDTH / 2)
      minY = Math.min(minY, pinned.y - CARD_HEIGHT / 2)
      maxY = Math.max(maxY, pinned.y + CARD_HEIGHT / 2)
    })

    // Store bounds for label positioning
    if (catItems.length > 0) {
      clusterBounds[cat] = {
        minX, maxX, minY, maxY,
        centerX: (minX + maxX) / 2,
        topY: minY - LABEL_PADDING
      }
    } else {
      // Empty category - use cluster center
      clusterBounds[cat] = {
        centerX: clusterCenterX,
        topY: clusterCenterY - 50
      }
    }
  })

  return { positions, clusterBounds }
}

// Snap position to grid
function snapToGrid(x, y) {
  const gridX = CARD_WIDTH + CARD_GAP
  const gridY = CARD_HEIGHT + CARD_GAP
  return {
    x: Math.round(x / gridX) * gridX + CARD_WIDTH / 2,
    y: Math.round(y / gridY) * gridY + CARD_HEIGHT / 2
  }
}

function CloudView({
  items,
  filteredItems,
  availableCategories,
  isAdmin,
  onNavigate,
  token,
  onItemUpdate
}) {
  const containerRef = useRef(null)
  const panRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)

  // Dragging state
  const [draggingItem, setDraggingItem] = useState(null)
  const [dragPosition, setDragPosition] = useState(null)
  const [ghostPosition, setGhostPosition] = useState(null)

  // Pinned positions from items
  const pinnedPositions = useMemo(() => {
    const pinned = {}
    items.forEach(item => {
      if (item.pinnedX != null && item.pinnedY != null) {
        pinned[item.id] = { x: item.pinnedX, y: item.pinnedY }
      }
    })
    return pinned
  }, [items])

  const panState = useRef({ x: 0, y: 0 })
  const dragState = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category).filter(Boolean))]
    return cats.length > 0 ? cats : ['other']
  }, [items])

  // Stratified positions with subcategory layering
  const { positions: itemPositions, clusterBounds } = useMemo(() => {
    return getStratifiedPositions(items, categories, containerSize.width, containerSize.height, pinnedPositions)
  }, [items, categories, containerSize, pinnedPositions])

  const filteredIds = useMemo(() => {
    return new Set(filteredItems.map(item => item.id))
  }, [filteredItems])

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

  // Save pinned position to database
  const savePinnedPosition = useCallback(async (itemId, x, y) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/item/${itemId}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pinnedX: x, pinnedY: y })
      })

      if (response.ok && onItemUpdate) {
        onItemUpdate(itemId, { pinnedX: x, pinnedY: y })
      }
      return response.ok
    } catch (error) {
      console.error('Failed to save pinned position:', error)
      return false
    }
  }, [token, onItemUpdate])

  // Clear pinned position
  const clearPinnedPosition = useCallback(async (itemId) => {
    if (!token) return false

    try {
      const response = await fetch(`${API_URL}/item/${itemId}/pin`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok && onItemUpdate) {
        onItemUpdate(itemId, { pinnedX: null, pinnedY: null })
      }
      return response.ok
    } catch (error) {
      console.error('Failed to clear pinned position:', error)
      return false
    }
  }, [token, onItemUpdate])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e) => {
      // Check if clicking on a card (for dragging)
      const card = e.target.closest('[data-item-id]')
      if (card && isAdmin && token) {
        const itemId = card.dataset.itemId
        const item = items.find(i => i.id === itemId)
        if (item) {
          e.preventDefault()
          e.stopPropagation()

          const rect = panRef.current.getBoundingClientRect()
          const x = (e.clientX - rect.left) / zoom
          const y = (e.clientY - rect.top) / zoom

          setDraggingItem(item)
          setDragPosition({ x, y })
          setGhostPosition(snapToGrid(x, y))
          return
        }
      }

      // Otherwise, pan the view
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
      if (draggingItem) {
        const rect = panRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) / zoom
        const y = (e.clientY - rect.top) / zoom

        setDragPosition({ x, y })
        setGhostPosition(snapToGrid(x, y))
        return
      }

      if (!dragState.current.isPanning) return
      panState.current.x = dragState.current.startPanX + (e.clientX - dragState.current.startX)
      panState.current.y = dragState.current.startPanY + (e.clientY - dragState.current.startY)
      updateTransform()
    }

    const handleMouseUp = async () => {
      if (draggingItem && ghostPosition) {
        await savePinnedPosition(draggingItem.id, ghostPosition.x, ghostPosition.y)
        setDraggingItem(null)
        setDragPosition(null)
        setGhostPosition(null)
        return
      }

      dragState.current.isPanning = false
      container.style.cursor = 'grab'
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(z => Math.min(3, Math.max(0.3, z * delta)))
    }

    const handleTouchStart = (e) => {
      const touch = e.touches[0]

      // Check if touching a card (for dragging)
      const card = e.target.closest('[data-item-id]')
      if (card && isAdmin && token) {
        const itemId = card.dataset.itemId
        const item = items.find(i => i.id === itemId)
        if (item) {
          const rect = panRef.current.getBoundingClientRect()
          const x = (touch.clientX - rect.left) / zoom
          const y = (touch.clientY - rect.top) / zoom

          setDraggingItem(item)
          setDragPosition({ x, y })
          setGhostPosition(snapToGrid(x, y))
          return
        }
      }

      dragState.current = {
        isPanning: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startPanX: panState.current.x,
        startPanY: panState.current.y
      }
    }

    const handleTouchMove = (e) => {
      const touch = e.touches[0]

      if (draggingItem) {
        const rect = panRef.current.getBoundingClientRect()
        const x = (touch.clientX - rect.left) / zoom
        const y = (touch.clientY - rect.top) / zoom

        setDragPosition({ x, y })
        setGhostPosition(snapToGrid(x, y))
        return
      }

      if (!dragState.current.isPanning) return
      panState.current.x = dragState.current.startPanX + (touch.clientX - dragState.current.startX)
      panState.current.y = dragState.current.startPanY + (touch.clientY - dragState.current.startY)
      updateTransform()
    }

    const handleTouchEnd = async () => {
      if (draggingItem && ghostPosition) {
        await savePinnedPosition(draggingItem.id, ghostPosition.x, ghostPosition.y)
        setDraggingItem(null)
        setDragPosition(null)
        setGhostPosition(null)
        return
      }

      dragState.current.isPanning = false
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [updateTransform, draggingItem, ghostPosition, savePinnedPosition, isAdmin, token, items, zoom])

  const itemsData = useMemo(() => {
    return items.map((item) => {
      const isFiltered = filteredIds.has(item.id)
      const isMatching = filteredItems.length === items.length || isFiltered
      const position = itemPositions[item.id] || { x: 400, y: 300 }
      const isPrivate = (item.private === 'true' || item.private === true) && !isAdmin
      const shouldBlurPhoto = ((item.private === 'true' || item.private === true) ||
                               (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
      const isPinned = pinnedPositions[item.id] != null
      return { item, position, isMatching, isPrivate, shouldBlurPhoto, isPinned }
    })
  }, [items, filteredIds, filteredItems.length, itemPositions, isAdmin, pinnedPositions])

  const handleCardClick = useCallback((e, item, isPrivate) => {
    // Don't navigate if we just finished dragging
    if (draggingItem) return

    if (!dragState.current.isPanning && !isPrivate) {
      e.stopPropagation()
      onNavigate(item.id)
    }
  }, [onNavigate, draggingItem])

  const handleUnpin = useCallback(async (e, itemId) => {
    e.stopPropagation()
    await clearPinnedPosition(itemId)
  }, [clearPinnedPosition])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 cursor-grab select-none"
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}
          className="w-8 h-8 bg-white dark:bg-neutral-800 rounded border border-neutral-300 dark:border-neutral-600 text-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(1); panState.current = { x: 0, y: 0 }; updateTransform() }}
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
          inset: 0,
          willChange: 'transform',
          transformOrigin: 'center center',
          transform: 'translate3d(0, 0, 0) scale(1)'
        }}
      >
        {/* Category labels - positioned above topmost card in each cluster */}
        {categories.map(cat => {
          const bounds = clusterBounds[cat]
          if (!bounds) return null
          const displayName = availableCategories.find(c => c.name === cat)?.displayName || cat
          return (
            <div
              key={`label-${cat}`}
              className="absolute pointer-events-none text-[10px] font-semibold uppercase tracking-wide opacity-60 whitespace-nowrap"
              style={{
                left: bounds.centerX,
                top: bounds.topY,
                transform: 'translateX(-50%)',
                color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other,
                zIndex: 100 // Always above cards
              }}
            >
              {displayName}
            </div>
          )
        })}

        {/* Item cards */}
        {itemsData.map(({ item, position, isMatching, isPrivate, shouldBlurPhoto, isPinned }) => {
          const isDragging = draggingItem?.id === item.id
          const displayPosition = isDragging && dragPosition ? dragPosition : position

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              className={`absolute ${isAdmin && token ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                left: displayPosition.x - CARD_WIDTH / 2,
                top: displayPosition.y - CARD_HEIGHT / 2,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                opacity: isDragging ? 0.7 : (isMatching ? 1 : 0.2),
                transform: `scale(${isMatching ? 1 : 0.8})`,
                zIndex: isDragging ? 1000 : (isMatching ? 10 : 1),
                transition: isDragging ? 'none' : 'opacity 0.15s, transform 0.15s'
              }}
              onClick={(e) => handleCardClick(e, item, isPrivate)}
            >
              <div
                className={`w-full h-full rounded overflow-hidden bg-white dark:bg-neutral-800 shadow-sm ${isPrivate ? 'opacity-50' : ''}`}
                style={{
                  borderWidth: isPinned ? 3 : 2,
                  borderStyle: isPinned ? 'dashed' : 'solid',
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

              {/* Unpin button for pinned items */}
              {isPinned && isAdmin && token && !isDragging && (
                <button
                  onClick={(e) => handleUnpin(e, item.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-red-600 z-50"
                  title="Unpin"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* Ghost preview for drag target */}
        {draggingItem && ghostPosition && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: ghostPosition.x - CARD_WIDTH / 2,
              top: ghostPosition.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
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
          ? 'Drag cards to pin • Scroll to zoom • Click to view'
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
