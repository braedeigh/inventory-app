import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

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

// Grid-based positioning within category clusters - no overlap
function getGridPositions(items, categories, containerWidth, containerHeight) {
  const positions = {}

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
    const itemCount = catItems.length

    // Calculate grid dimensions for this cluster
    const cols = Math.ceil(Math.sqrt(itemCount))
    const rows = Math.ceil(itemCount / cols)

    // Grid starts offset from cluster center
    const gridWidth = cols * (CARD_WIDTH + CARD_GAP)
    const gridHeight = rows * (CARD_HEIGHT + CARD_GAP)
    const startX = clusterCenterX - gridWidth / 2
    const startY = clusterCenterY - gridHeight / 2

    catItems.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      positions[item.id] = {
        x: startX + col * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2,
        y: startY + row * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2,
        category: cat
      }
    })
  })

  return positions
}

function CloudView({
  items,
  filteredItems,
  availableCategories,
  isAdmin,
  onNavigate
}) {
  const containerRef = useRef(null)
  const panRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)

  const panState = useRef({ x: 0, y: 0 })
  const dragState = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category).filter(Boolean))]
    return cats.length > 0 ? cats : ['other']
  }, [items])

  // Grid positions for all items - no overlap
  const itemPositions = useMemo(() => {
    return getGridPositions(items, categories, containerSize.width, containerSize.height)
  }, [items, categories, containerSize])

  // Category label positions
  const categoryLabelPositions = useMemo(() => {
    const positions = {}
    const numCategories = categories.length
    const centerX = containerSize.width / 2
    const centerY = containerSize.height / 2
    const radius = Math.min(containerSize.width, containerSize.height) * 0.35

    categories.forEach((cat, i) => {
      const angle = (i / numCategories) * 2 * Math.PI - Math.PI / 2
      positions[cat] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle) - 50
      }
    })
    return positions
  }, [categories, containerSize])

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

  // Update transform when zoom changes
  useEffect(() => {
    updateTransform()
  }, [zoom, updateTransform])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e) => {
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
      if (!dragState.current.isPanning) return
      panState.current.x = dragState.current.startPanX + (e.clientX - dragState.current.startX)
      panState.current.y = dragState.current.startPanY + (e.clientY - dragState.current.startY)
      updateTransform()
    }

    const handleMouseUp = () => {
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
      dragState.current = {
        isPanning: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startPanX: panState.current.x,
        startPanY: panState.current.y
      }
    }

    const handleTouchMove = (e) => {
      if (!dragState.current.isPanning) return
      const touch = e.touches[0]
      panState.current.x = dragState.current.startPanX + (touch.clientX - dragState.current.startX)
      panState.current.y = dragState.current.startPanY + (touch.clientY - dragState.current.startY)
      updateTransform()
    }

    const handleTouchEnd = () => {
      dragState.current.isPanning = false
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
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
  }, [updateTransform])

  const itemsData = useMemo(() => {
    return items.map((item) => {
      const isFiltered = filteredIds.has(item.id)
      const isMatching = filteredItems.length === items.length || isFiltered
      const position = itemPositions[item.id] || { x: 400, y: 300 }
      const isPrivate = (item.private === 'true' || item.private === true) && !isAdmin
      const shouldBlurPhoto = ((item.private === 'true' || item.private === true) ||
                               (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
      return { item, position, isMatching, isPrivate, shouldBlurPhoto }
    })
  }, [items, filteredIds, filteredItems.length, itemPositions, isAdmin])

  const handleCardClick = useCallback((e, item, isPrivate) => {
    if (!dragState.current.isPanning && !isPrivate) {
      e.stopPropagation()
      onNavigate(item.id)
    }
  }, [onNavigate])

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
        {/* Category labels */}
        {categories.map(cat => {
          const pos = categoryLabelPositions[cat]
          if (!pos) return null
          const displayName = availableCategories.find(c => c.name === cat)?.displayName || cat
          return (
            <div
              key={`label-${cat}`}
              className="absolute pointer-events-none text-[10px] font-semibold uppercase tracking-wide opacity-50 whitespace-nowrap"
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translateX(-50%)',
                color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
              }}
            >
              {displayName}
            </div>
          )
        })}

        {/* Item cards - smaller */}
        {itemsData.map(({ item, position, isMatching, isPrivate, shouldBlurPhoto }) => (
          <div
            key={item.id}
            className="absolute cursor-pointer"
            style={{
              left: position.x - CARD_WIDTH / 2,
              top: position.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              opacity: isMatching ? 1 : 0.2,
              transform: `scale(${isMatching ? 1 : 0.8})`,
              zIndex: isMatching ? 10 : 1,
              transition: 'opacity 0.15s, transform 0.15s'
            }}
            onClick={(e) => handleCardClick(e, item, isPrivate)}
          >
            <div
              className={`w-full h-full rounded overflow-hidden bg-white dark:bg-neutral-800 shadow-sm ${isPrivate ? 'opacity-50' : ''}`}
              style={{
                borderWidth: 2,
                borderStyle: 'solid',
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
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 text-xs text-neutral-400 pointer-events-none">
        Drag to pan • Scroll to zoom • Click card to view
      </div>

      {/* Item count & zoom level */}
      <div className="absolute bottom-3 right-3 text-xs text-neutral-400 pointer-events-none">
        {filteredItems.length}/{items.length} • {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

export default CloudView
