import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Category colors for borders
const CATEGORY_COLORS = {
  clothing: '#22c55e',      // green
  jewelry: '#eab308',       // yellow
  electronics: '#3b82f6',   // blue
  furniture: '#a855f7',     // purple
  kitchenware: '#f97316',   // orange
  books: '#78716c',         // stone
  bedding: '#ec4899',       // pink
  toiletries: '#06b6d4',    // cyan
  other: '#6b7280',         // gray
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

// Add some randomness to positions within a cluster
function getItemPosition(item, clusterPositions, index, isFiltered) {
  const cluster = clusterPositions[item.category] || { x: 400, y: 300 }

  // Use item id to create consistent "random" offset
  const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const offsetX = (Math.sin(hash) * 80) + (Math.cos(hash * 2) * 40)
  const offsetY = (Math.cos(hash) * 80) + (Math.sin(hash * 2) * 40)

  if (isFiltered) {
    // Filtered items cluster toward center
    return {
      x: cluster.x * 0.3 + 400 * 0.7 + offsetX * 0.5,
      y: cluster.y * 0.3 + 300 * 0.7 + offsetY * 0.5
    }
  }

  return {
    x: cluster.x + offsetX,
    y: cluster.y + offsetY
  }
}

function CloudView({
  items,
  filteredItems,
  availableCategories,
  isAdmin,
  onNavigate
}) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 })

  // Get unique categories from items
  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category).filter(Boolean))]
    return cats.length > 0 ? cats : ['other']
  }, [items])

  // Calculate cluster positions
  const clusterPositions = useMemo(() => {
    return getCategoryClusterPositions(categories, containerSize.width, containerSize.height)
  }, [categories, containerSize])

  // Create a Set of filtered item IDs for quick lookup
  const filteredIds = useMemo(() => {
    return new Set(filteredItems.map(item => item.id))
  }, [filteredItems])

  // Update container size on mount and resize
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

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('cloud-bg')) {
      setIsPanning(true)
      setStartPan(pan)
      setStartMouse({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: startPan.x + (e.clientX - startMouse.x),
        y: startPan.y + (e.clientY - startMouse.y)
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('cloud-bg')) {
      const touch = e.touches[0]
      setIsPanning(true)
      setStartPan(pan)
      setStartMouse({ x: touch.clientX, y: touch.clientY })
    }
  }

  const handleTouchMove = (e) => {
    if (isPanning) {
      const touch = e.touches[0]
      setPan({
        x: startPan.x + (touch.clientX - startMouse.x),
        y: startPan.y + (touch.clientY - startMouse.y)
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Background layer for panning */}
      <div className="cloud-bg absolute inset-0" />

      {/* Category labels */}
      {categories.map(cat => {
        const pos = clusterPositions[cat]
        if (!pos) return null
        const displayName = availableCategories.find(c => c.name === cat)?.displayName || cat
        return (
          <motion.div
            key={`label-${cat}`}
            className="absolute pointer-events-none text-xs font-medium uppercase tracking-wide opacity-30"
            style={{
              color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
            }}
            animate={{
              x: pos.x + pan.x - 30,
              y: pos.y + pan.y - 60
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          >
            {displayName}
          </motion.div>
        )
      })}

      {/* Item cards */}
      <AnimatePresence>
        {items.map((item, index) => {
          const isFiltered = filteredIds.has(item.id)
          const isMatching = filteredItems.length === items.length || isFiltered
          const pos = getItemPosition(item, clusterPositions, index, isFiltered && filteredItems.length < items.length)

          const isPrivate = (item.private === 'true' || item.private === true) && !isAdmin
          const shouldBlurPhoto = ((item.private === 'true' || item.private === true) ||
                                   (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin

          return (
            <motion.div
              key={item.id}
              className={`absolute cursor-pointer select-none ${isPanning ? 'pointer-events-none' : ''}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                x: pos.x + pan.x - 40,
                y: pos.y + pan.y - 50,
                opacity: isMatching ? 1 : 0.15,
                scale: isMatching ? 1 : 0.6,
                zIndex: isMatching ? 10 : 1
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                type: 'spring',
                stiffness: 150,
                damping: 20,
                opacity: { duration: 0.2 }
              }}
              onClick={(e) => {
                if (!isPanning && !isPrivate) {
                  e.stopPropagation()
                  onNavigate(item.id)
                }
              }}
              whileHover={!isPanning ? { scale: isMatching ? 1.1 : 0.7 } : {}}
            >
              <div
                className={`w-20 h-24 rounded-lg overflow-hidden bg-white dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow ${isPrivate ? 'opacity-50' : ''}`}
                style={{
                  borderWidth: 3,
                  borderStyle: 'solid',
                  borderColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other
                }}
              >
                {/* Thumbnail */}
                <div className="w-full h-14 bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  {item.mainPhoto ? (
                    <img
                      src={item.mainPhoto}
                      alt={item.itemName}
                      className={`w-full h-full object-cover ${shouldBlurPhoto ? 'blur-md' : ''}`}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                      No img
                    </div>
                  )}
                </div>
                {/* Name */}
                <div className={`p-1 text-[10px] leading-tight text-center truncate ${isPrivate ? 'blur-sm' : ''}`}>
                  {isPrivate ? 'Private' : item.itemName}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

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
