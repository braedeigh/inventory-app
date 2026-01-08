import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PrivateText from './PrivateText.jsx'
import ItemForm from './components/ItemForm.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Home({ list, setList, token, userRole, setShowLogin, handleLogout }) {
  const isAdmin = userRole === 'admin'

  // Show all items - private ones will be blurred for non-admin users
  const visibleList = list
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const navigate = useNavigate()
  const [sortOrder, setSortOrder] = useState('newest')
  const [randomKey, setRandomKey] = useState(0) // Used to force re-randomization
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGifted, setSelectedGifted] = useState(null) // null = all, true = gifted only, false = not gifted only
  const [selectedMaterials, setSelectedMaterials] = useState([]) // OR logic filter
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableMaterials, setAvailableMaterials] = useState([])

  // Categories state
  const [availableCategories, setAvailableCategories] = useState([])

  // Subcategories state
  const [availableSubcategories, setAvailableSubcategories] = useState([])

  // Filters UI state
  const [showFilters, setShowFilters] = useState(false)

  const [editForm, setEditForm] = useState({
    itemName: '',
    description: '',
    category: '',
    subcategory: '',
    origin: ''
  })

  // Restore scroll position from sessionStorage on mount
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('inventoryScrollPosition')
    if (savedScrollPosition) {
      // Small delay to ensure content is rendered before scrolling
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10))
      }, 100)
      // Clear after restoring so fresh visits start at top
      sessionStorage.removeItem('inventoryScrollPosition')
    }
  }, [])

  // Fetch available materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await fetch(`${API_URL}/materials`)
        if (response.ok) {
          const data = await response.json()
          setAvailableMaterials(data)
        }
      } catch (err) {
        console.error('Failed to fetch materials:', err)
      }
    }
    fetchMaterials()
  }, [])

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories`)
        if (response.ok) {
          const data = await response.json()
          setAvailableCategories(data)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch available subcategories
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        const response = await fetch(`${API_URL}/subcategories`)
        if (response.ok) {
          const data = await response.json()
          setAvailableSubcategories(data)
        }
      } catch (err) {
        console.error('Failed to fetch subcategories:', err)
      }
    }
    fetchSubcategories()
  }, [])

  // Callback when a new item is created via ItemForm
  const handleItemCreated = (newItem) => {
    setList([newItem, ...list])
  }

  const handleEdit = (index) => {
    const item = list[index]
    setEditForm({
      id: item.id,
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      origin: '',
      secondhand: ''
    })
    setEditingIndex(index)
  }

  const handleDelete = async (itemId) => {
    if (!token) {
      console.error("User not logged in. Cannot delete item.")
      return
    }
    
    const itemToDelete = list.find(item => item.id === itemId)
    const itemIndex = list.findIndex(item => item.id === itemId)
    
    const response = await fetch(`${API_URL}/item/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      setDeletedHistory([...deletedHistory, { item: itemToDelete, position: itemIndex }])
      setList(list.filter(item => item.id !== itemId))
    } else {
      console.error("Failed to delete item.", await response.text())
    }
  }

  const handleUndo = async () => {
    if (deletedHistory.length === 0 || !token) return

    const lastDeleted = deletedHistory[deletedHistory.length - 1]
    
    const formData = new FormData()
    formData.append('id', lastDeleted.item.id)
    formData.append('itemName', lastDeleted.item.itemName)
    formData.append('description', lastDeleted.item.description)
    formData.append('category', lastDeleted.item.category)
    formData.append('origin', lastDeleted.item.origin)
    formData.append('createdAt', lastDeleted.item.createdAt)
    if (lastDeleted.item.mainPhoto) {
      formData.append('mainPhoto', lastDeleted.item.mainPhoto)
    }
    const response = await fetch(API_URL + '/', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (response.ok) {
      const newList = [...list]
      newList.splice(lastDeleted.position, 0, lastDeleted.item)
      setList(newList)
      setDeletedHistory(deletedHistory.slice(0, -1))
    } else {
      console.error("Failed to undo delete.", await response.text())
    }
  }

  const handleSave = async () => {
    if (!token) {
      console.error("User not logged in. Cannot save item.")
      return
    }

    const response = await fetch(`${API_URL}/item/${editForm.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(editForm)
    })

    if (response.ok) {
      const updatedItem = await response.json()
      const updatedList = list.map(item => 
        item.id === editForm.id ? updatedItem : item
      )
      setList(updatedList)
      setEditingIndex(null)
    } else {
      console.error("Failed to save item.", await response.text())
    }
  }

  const handleCancel = () => {
    setEditingIndex(null)
  }

  // Save scroll position before navigating to item detail
  const navigateToItem = (itemId, editMode = false) => {
    sessionStorage.setItem('inventoryScrollPosition', window.scrollY.toString())
    navigate(`/item/${itemId}${editMode ? '?edit=true' : ''}`)
  }

  // Helper to filter items, optionally excluding a specific filter type
  const getFilteredItems = (excludeFilter = null) => {
    return visibleList.filter(item => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          item.itemName.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.origin?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.subcategory?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Category filter
      if (excludeFilter !== 'category' && selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false

      // Subcategory filter (for clothing)
      if (excludeFilter !== 'subcategory' && item.category === 'clothing' && selectedSubcategories.length > 0) {
        const isUncategorized = !item.subcategory || item.subcategory === ''
        if (selectedSubcategories.includes('uncategorized') && isUncategorized) {
          // passes
        } else if (!selectedSubcategories.includes(item.subcategory)) {
          return false
        }
      }

      // Source filter
      if (excludeFilter !== 'source' && selectedSources.length > 0 && !selectedSources.includes(item.secondhand)) return false

      // Gifted filter
      if (excludeFilter !== 'gifted' && selectedGifted !== null) {
        const isGifted = item.gifted === 'true' || item.gifted === true
        if (selectedGifted && !isGifted) return false
        if (!selectedGifted && isGifted) return false
      }

      // Materials filter
      if (excludeFilter !== 'materials' && selectedMaterials.length > 0) {
        if (!item.materials || item.materials.length === 0) return false
        const itemMaterialNames = item.materials.map(m => m.material)
        const hasAnySelectedMaterial = selectedMaterials.some(mat => itemMaterialNames.includes(mat))
        if (!hasAnySelectedMaterial) return false
      }

      return true
    })
  }

  const filteredAndSortedList = visibleList
    .filter(item => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          item.itemName.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.origin?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.subcategory?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false

      // Subcategory filter (for clothing)
      if (item.category === 'clothing' && selectedSubcategories.length > 0) {
        // Handle "uncategorized" filter for items with no subcategory
        const isUncategorized = !item.subcategory || item.subcategory === ''
        if (selectedSubcategories.includes('uncategorized') && isUncategorized) {
          // passes subcategory filter
        } else if (!selectedSubcategories.includes(item.subcategory)) {
          return false
        }
      }

      // Source filter (new/secondhand/handmade/unknown)
      if (selectedSources.length > 0 && !selectedSources.includes(item.secondhand)) return false

      // Gifted filter
      if (selectedGifted !== null) {
        const isGifted = item.gifted === 'true' || item.gifted === true
        if (selectedGifted && !isGifted) return false
        if (!selectedGifted && isGifted) return false
      }

      // Materials filter (OR logic)
      if (selectedMaterials.length > 0) {
        if (!item.materials || item.materials.length === 0) return false
        const itemMaterialNames = item.materials.map(m => m.material)
        const hasAnySelectedMaterial = selectedMaterials.some(mat => itemMaterialNames.includes(mat))
        if (!hasAnySelectedMaterial) return false
      }

      return true
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt)
      } else if (sortOrder === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt)
      } else if (sortOrder === 'alphabetical') {
        return a.itemName.localeCompare(b.itemName)
      } else if (sortOrder === 'random') {
        return Math.random() - 0.5
      }
    })
  
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100">
      

{/* Header */}
<div className="mb-6">
  {/* Buttons row */}
  <div className="flex justify-between items-center mb-3 md:mb-0">
    <button
      onClick={() => navigate('/')}
      className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
    >
      ← Home
    </button>
    {token ? (
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
      >
        Logout
      </button>
    ) : (
      <button
        onClick={() => setShowLogin(true)}
        className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
      >
        Login
      </button>
    )}
  </div>
  {/* Title - below buttons on mobile, inline on desktop */}
  <h1 className="text-3xl md:text-4xl font-light font-serif text-center">Bradie's Inventory</h1>
</div>

{/* Info for logged out users */}
{!token && (
  <div className="mb-6 text-neutral-600 dark:text-neutral-400">
    <p className="mb-2">This is my inventory of items, created for performance art, to learn to code, to create a portfolio, and to keep track of the items that I have.</p>
    <p>If the inventory does not yet display items, wait 50 seconds and refresh the page.</p>
  </div>
)}

      {/* Add Item Form */}
      {token && (
        <ItemForm
          token={token}
          availableMaterials={availableMaterials}
          setAvailableMaterials={setAvailableMaterials}
          availableCategories={availableCategories}
          setAvailableCategories={setAvailableCategories}
          availableSubcategories={availableSubcategories}
          setAvailableSubcategories={setAvailableSubcategories}
          list={list}
          isAdmin={isAdmin}
          onItemCreated={handleItemCreated}
        />
      )}


      {/* My Items Header */}
      <div className="flex justify-between items-center mb-4 mt-10">
        <h2 className="text-3xl font-light text-green-700 dark:text-green-500">My Items</h2>
      </div>

      {/* Sort, Search, and Filters Toggle */}
      <div className="flex flex-wrap gap-4 items-center mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm">Sort by:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">A-Z</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSortOrder('random')
              setRandomKey(k => k + 1)
            }}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
          >
            Randomize
          </button>
        </div>

        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 w-48"
        />

        {/* Filters toggle button */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 ${
            showFilters || selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSources.length > 0 || selectedGifted !== null || selectedMaterials.length > 0
              ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <span>{showFilters ? '▼' : '▶'} Filters</span>
          {(selectedCategories.length + selectedSubcategories.length + selectedSources.length + (selectedGifted !== null ? 1 : 0) + selectedMaterials.length) > 0 && (
            <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {selectedCategories.length + selectedSubcategories.length + selectedSources.length + (selectedGifted !== null ? 1 : 0) + selectedMaterials.length}
            </span>
          )}
        </button>

        {/* Clear all filters button - only show when filters are active */}
        {(selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedSources.length > 0 || selectedGifted !== null || selectedMaterials.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategories([])
              setSelectedSubcategories([])
              setSelectedSources([])
              setSelectedGifted(null)
              setSelectedMaterials([])
            }}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Collapsible Filters Section */}
      {showFilters && (
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
      )}

      {/* Undo Delete button */}
      {deletedHistory.length > 0 && isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleUndo}
            className="px-4 py-2 text-sm bg-yellow-300 text-black rounded-lg hover:bg-yellow-400 transition-all"
          >
            Undo Delete ({deletedHistory.length})
          </button>
        </div>
      )}

      {/* Table - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
<thead>
  <tr className="bg-green-600 text-white">
    <th className="p-3 text-left w-18">Photo</th>
    <th className="p-3 text-left w-1/6">Item Name</th>
    <th className="p-3 text-left">Description</th>
    <th className="p-3 text-left w-1/6">Origin</th>
    {isAdmin && <th className="p-3 text-left w-38">Actions</th>}
  </tr>
</thead>
          <tbody>
            {filteredAndSortedList.map((item, index) => {
              const isPrivateItem = item.private === 'true' || item.private === true
              const shouldBlur = isPrivateItem && !isAdmin
              const shouldBlurPhotos = ((item.private === 'true' || item.private === true) || (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
              const shouldBlurDescription = ((item.private === 'true' || item.private === true) || (item.privateDescription === 'true' || item.privateDescription === true)) && !isAdmin
              const shouldBlurOrigin = ((item.private === 'true' || item.private === true) || (item.privateOrigin === 'true' || item.privateOrigin === true)) && !isAdmin
              return (
              <tr
                key={index}
                onClick={() => {
                  if (editingIndex !== index && !shouldBlur) {
                    navigateToItem(item.id)
                  }
                }}
                className={`border-b border-neutral-200 dark:border-neutral-700 ${shouldBlur ? 'opacity-60' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'}`}
              >
                <td className="p-3 w-16" onClick={(e) => e.stopPropagation()}>
                  {item.mainPhoto ? (
                    <img src={item.mainPhoto} alt={item.itemName} className={`w-12 h-12 object-cover rounded ${shouldBlurPhotos ? 'blur-md' : ''}`} />
                  ) : (
                    <div className={`w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center text-neutral-400 ${shouldBlurPhotos ? 'blur-sm' : ''}`}>+</div>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <input
                      value={editForm.itemName}
                      onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlur ? 'blur-sm' : ''}`}>
                      {shouldBlur ? 'Private Item' : item.itemName}
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900 w-full"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlurDescription ? 'blur-sm' : ''}`}>
                      {shouldBlurDescription ? '••••••••••••••••' : <PrivateText text={item.description} isAuthenticated={!!token} isAdmin={isAdmin} />}
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {editingIndex === index ? (
                    <input
                      value={editForm.origin}
                      onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                      className="px-2 py-1 border rounded bg-white dark:bg-neutral-900"
                    />
                  ) : (
                    <span className={`block truncate ${shouldBlurOrigin ? 'blur-sm' : ''}`}>
                      {shouldBlurOrigin ? '••••••' : item.origin}
                    </span>
                  )}
                </td>
                
                {isAdmin && (
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigateToItem(item.id, true)
                        }}
                        className="px-3 py-1 text-sm bg-blue-200 text-black rounded hover:bg-blue-400 transition-all"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id)
                        }}
                        className="px-3 py-1 text-sm bg-red-200 text-black rounded hover:bg-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredAndSortedList.map((item, index) => {
          const isPrivateItem = item.private === 'true' || item.private === true
          const shouldBlur = isPrivateItem && !isAdmin
          const shouldBlurPhotos = ((item.private === 'true' || item.private === true) || (item.privatePhotos === 'true' || item.privatePhotos === true)) && !isAdmin
          const shouldBlurDescription = ((item.private === 'true' || item.private === true) || (item.privateDescription === 'true' || item.privateDescription === true)) && !isAdmin
          const shouldBlurOrigin = ((item.private === 'true' || item.private === true) || (item.privateOrigin === 'true' || item.privateOrigin === true)) && !isAdmin
          return (
          <div
            key={index}
            className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 ${shouldBlur ? 'opacity-60' : 'cursor-pointer'}`}
            onClick={() => !shouldBlur && navigateToItem(item.id)}
          >
            {item.mainPhoto && (
              <img src={item.mainPhoto} alt={item.itemName} className={`w-full max-w-[200px] h-auto rounded-lg mb-3 ${shouldBlurPhotos ? 'blur-lg' : ''}`} />
            )}
            <div className={`mb-2 ${shouldBlur ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Name:</strong> {shouldBlur ? 'Private Item' : item.itemName}
            </div>
            <div className={`mb-2 ${shouldBlurDescription ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Description:</strong> {shouldBlurDescription ? '••••••••••••••••' : <PrivateText text={item.description} isAuthenticated={!!token} isAdmin={isAdmin} />}
            </div>
            <div className={`mb-2 ${shouldBlur ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Category:</strong> {shouldBlur ? '••••••' : item.category}
            </div>
            <div className={`mb-2 ${shouldBlurOrigin ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Origin:</strong> {shouldBlurOrigin ? '••••••' : item.origin}
            </div>
            
            {isAdmin && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                {confirmDelete === item.id ? (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg">
                    <p className="text-sm text-center mb-2">Delete this item?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handleDelete(item.id)
                          setConfirmDelete(null)
                        }}
                        className="flex-1 py-2 text-base bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2 text-base bg-neutral-300 dark:bg-neutral-600 rounded-lg hover:bg-neutral-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigateToItem(item.id, true)}
                      className="flex-1 py-2 text-base bg-blue-200 text-black rounded-lg hover:bg-blue-300 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item.id)}
                      className="flex-1 py-2 text-base bg-red-200 text-black rounded-lg hover:bg-red-300 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default Home