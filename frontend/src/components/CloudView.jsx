import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

// Category colors for borders
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

// Calculate cluster positions for categories
function getCategoryClusterPositions(categories, containerWidth, containerHeight) {
  const positions = {}
  const numCategories = categories.length
  const centerX = containerWidth / 2
  const centerY = containerHeight / 2
  const radius = Math.min(containerWidth, containerHeight) * 0.3

  categories.forEach((cat, i) => {
    const angle = (i / numCategories) * 2 * Math.PI - Math.PI / 2
    positions[cat] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    }
  })

  return positions
}

// Get item position within cluster
function getItemPosition(item, clusterPositions, index, isFiltered) {
  const cluster = clusterPositions[item.category] || { x: 400, y: 300 }
  const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const offsetX = (Math.sin(hash) * 80) + (Math.cos(hash * 2) * 40)
  const offsetY = (Math.cos(hash) * 80) + (Math.sin(hash * 2) * 40)

  if (isFiltered) {
    return {
      x: cluster.x * 0.3 + 400 * 0.7 + offsetX * 0.5,
      y: cluster.y * 0.3 + 300 * 0.7 + offsetY * 0.5
    }
  }

  return { x: cluster.x + offsetX, y: cluster.y + offsetY }
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

  // Use refs for pan state to avoid re-renders
  const panState = useRef({ x: 0, y: 0 })
  const dragState = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category).filter(Boolean))]
    return cats.length > 0 ? cats : ['other']
  }, [items])

  const clusterPositions = useMemo(() => {
    return getCategoryClusterPositions(categories, containerSize.width, containerSize.height)
  }, [categories, containerSize])

  const filteredIds = useMemo(() => {
    return new Set(filteredItems.map(item => item.id))
  }, [filteredItems])

  // Update container size
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

  // Direct DOM manipulation for smooth panning - no React re-renders
  const updatePanTransform = useCallback(() => {
    if (panRef.current) {
      panRef.current.style.transform = `translate3d(${panState.current.x}px, ${panState.current.y}px, 0)`
    }
  }, [])

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
      updatePanTransform()
    }

    const handleMouseUp = () => {
      dragState.current.isPanning = false
      container.style.cursor = 'grab'
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
      updatePanTransform()
    }

    const handleTouchEnd = () => {
      dragState.current.isPanning = false
    }

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [updatePanTransform])

  // Pre-compute item data
  const itemsData = useMemo(() => {
    return items.map((item, index) => {
      const isFiltered = filteredIds.has(item.id)
      const isMatching = filteredItems.length === items.length || isFiltered
      const position = getItemPosition(item, clusterPositions, index, isFiltered && filteredItems.length < items.length)
      const isPrivate = (item.private === 'true' || item.private === true) && !isAdmin
      const shouldBlurPhoto = ((item.private === 'true' || item.private === true) ||
                               (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
      return { item, position, isMatching, isPrivate, shouldBlurPhoto }
    })
  }, [items, filteredIds, filteredItems.length, clusterPositions, isAdmin])

  const handleCardClick = useCallback((e, item, isPrivate) => {
    // Only navigate if we didn't just finish a drag
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
      {/* Pannable container - uses transform3d for GPU acceleration */}
      <div
        ref={panRef}
        style={{
          position: 'absolute',
          inset: 0,
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)'
        }}
      >
        {/* Category labels */}
        {categories.map(cat => {
          const pos = clusterPositions[cat]
          if (!pos) return null
          const displayName = availableCategories.find(c => c.name === cat)?.displayName || cat
          return (
            <div
              key={`label-${cat}`}
              className="absolute pointer-events-none text-xs font-medium uppercase tracking-wide opacity-30"
              style={{
                left: pos.x - 30,
                top: pos.y - 60,
                color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
              }}
            >
              {displayName}
            </div>
          )
        })}

        {/* Item cards */}
        {itemsData.map(({ item, position, isMatching, isPrivate, shouldBlurPhoto }) => (
          <div
            key={item.id}
            className="absolute cursor-pointer"
            style={{
              left: position.x - 40,
              top: position.y - 50,
              opacity: isMatching ? 1 : 0.15,
              transform: `scale(${isMatching ? 1 : 0.6})`,
              zIndex: isMatching ? 10 : 1,
              transition: 'opacity 0.15s, transform 0.15s'
            }}
            onClick={(e) => handleCardClick(e, item, isPrivate)}
          >
            <div
              className={`w-20 h-24 rounded-lg overflow-hidden bg-white dark:bg-neutral-800 shadow-md ${isPrivate ? 'opacity-50' : ''}`}
              style={{
                borderWidth: 3,
                borderStyle: 'solid',
                borderColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other
              }}
            >
              <div className="w-full h-14 bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                {item.mainPhoto ? (
                  <img
                    src={item.mainPhoto}
                    alt={item.itemName}
                    className={`w-full h-full object-cover ${shouldBlurPhoto ? 'blur-md' : ''}`}
                    draggable={false}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                    No img
                  </div>
                )}
              </div>
              <div className={`p-1 text-[10px] leading-tight text-center truncate ${isPrivate ? 'blur-sm' : ''}`}>
                {isPrivate ? 'Private' : item.itemName}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 text-xs text-neutral-400 pointer-events-none">
        Drag to pan • Click card to view
      </div>

      {/* Item count */}
      <div className="absolute bottom-3 right-3 text-xs text-neutral-400 pointer-events-none">
        {filteredItems.length} / {items.length} items
      </div>
    </div>
  )
}

export default CloudView
