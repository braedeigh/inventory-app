function FilterPanel({
  showFilters,
  availableCategories,
  availableSubcategories,
  availableMaterials,
  selectedCategories,
  setSelectedCategories,
  selectedSubcategories,
  setSelectedSubcategories,
  selectedSources,
  setSelectedSources,
  selectedGifted,
  setSelectedGifted,
  selectedMaterials,
  setSelectedMaterials,
  getFilteredItems
}) {
  if (!showFilters) return null

  return (
    <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Category filters */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Categories</label>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map(cat => {
            const baseItems = getFilteredItems('category')
            const count = baseItems.filter(item => item.category === cat.name).length
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (selectedCategories.includes(cat.name)) {
                    setSelectedCategories(selectedCategories.filter(c => c !== cat.name))
                  } else {
                    setSelectedCategories([...selectedCategories, cat.name])
                  }
                }}
                className={`filter-button ${selectedCategories.includes(cat.name) ? 'active' : ''}`}
              >
                {cat.displayName} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Subcategory filters - only show if clothing selected */}
      {selectedCategories.includes('clothing') && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Clothing Type</label>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const baseItems = getFilteredItems('subcategory')
              const uncategorizedCount = baseItems.filter(item => item.category === 'clothing' && (!item.subcategory || item.subcategory === '')).length
              return uncategorizedCount > 0 && (
                <button
                  onClick={() => {
                    if (selectedSubcategories.includes('uncategorized')) {
                      setSelectedSubcategories(selectedSubcategories.filter(s => s !== 'uncategorized'))
                    } else {
                      setSelectedSubcategories([...selectedSubcategories, 'uncategorized'])
                    }
                  }}
                  className={`filter-button-sub ${selectedSubcategories.includes('uncategorized') ? 'active' : ''}`}
                >
                  Uncategorized ({uncategorizedCount})
                </button>
              )
            })()}
            {availableSubcategories
              .filter(sub => sub.category === 'clothing')
              .map(sub => {
                const baseItems = getFilteredItems('subcategory')
                const count = baseItems.filter(item => item.category === 'clothing' && item.subcategory === sub.name).length
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (selectedSubcategories.includes(sub.name)) {
                        setSelectedSubcategories(selectedSubcategories.filter(s => s !== sub.name))
                      } else {
                        setSelectedSubcategories([...selectedSubcategories, sub.name])
                      }
                    }}
                    className={`filter-button-sub ${selectedSubcategories.includes(sub.name) ? 'active' : ''}`}
                  >
                    {sub.displayName} ({count})
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Source filters */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Source</label>
        <div className="flex flex-wrap gap-2">
          {['new', 'secondhand', 'handmade', 'unknown'].map(source => {
            const baseItems = getFilteredItems('source')
            const count = baseItems.filter(item => item.secondhand === source).length
            return (
              <button
                key={source}
                onClick={() => {
                  if (selectedSources.includes(source)) {
                    setSelectedSources(selectedSources.filter(s => s !== source))
                  } else {
                    setSelectedSources([...selectedSources, source])
                  }
                }}
                className={`filter-button-sub ${selectedSources.includes(source) ? 'active' : ''}`}
              >
                {source.charAt(0).toUpperCase() + source.slice(1)} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Gifted filter */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Gifted</label>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const baseItems = getFilteredItems('gifted')
            return (
              <>
                <button
                  onClick={() => setSelectedGifted(selectedGifted === true ? null : true)}
                  className={`filter-button-sub ${selectedGifted === true ? 'active' : ''}`}
                >
                  Gifted ({baseItems.filter(item => item.gifted === 'true' || item.gifted === true).length})
                </button>
                <button
                  onClick={() => setSelectedGifted(selectedGifted === false ? null : false)}
                  className={`filter-button-sub ${selectedGifted === false ? 'active' : ''}`}
                >
                  Not Gifted ({baseItems.filter(item => item.gifted !== 'true' && item.gifted !== true).length})
                </button>
              </>
            )
          })()}
        </div>
      </div>

      {/* Materials filter - only show if clothing or bedding is selected */}
      {availableMaterials.length > 0 && (selectedCategories.includes('clothing') || selectedCategories.includes('bedding')) && (
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Materials</label>
          <div className="flex flex-wrap gap-2">
            {availableMaterials.map(mat => {
              const baseItems = getFilteredItems('materials')
              const count = baseItems.filter(item =>
                item.materials && item.materials.some(m => m.material === mat.name)
              ).length
              if (count === 0) return null
              return (
                <button
                  key={mat.id}
                  onClick={() => {
                    if (selectedMaterials.includes(mat.name)) {
                      setSelectedMaterials(selectedMaterials.filter(m => m !== mat.name))
                    } else {
                      setSelectedMaterials([...selectedMaterials, mat.name])
                    }
                  }}
                  className={`filter-button-sub ${selectedMaterials.includes(mat.name) ? 'active' : ''}`}
                >
                  {mat.name} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPanel
