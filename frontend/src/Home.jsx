import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ItemForm from './components/ItemForm.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import ItemTable from './components/ItemTable.jsx'
import ItemCard from './components/ItemCard.jsx'
import CloudView from './components/CloudView.jsx'
import { useInventoryData, useItemFilters } from './hooks/useInventoryData.js'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Home({ list, setList, token, userRole, setShowLogin, handleLogout }) {
  const isAdmin = userRole === 'admin'
  const navigate = useNavigate()

  // Get inventory data (materials, categories, subcategories)
  const {
    availableMaterials,
    setAvailableMaterials,
    availableCategories,
    setAvailableCategories,
    availableSubcategories,
    setAvailableSubcategories
  } = useInventoryData()

  // Filter state
  const [sortOrder, setSortOrder] = useState('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGifted, setSelectedGifted] = useState(null)
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  // UI state - default to cloud view, restore from session if available
  const [viewMode, setViewMode] = useState(() => {
    return sessionStorage.getItem('inventoryViewMode') || 'cloud'
  })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const [editingIndex] = useState(null)
  const [editForm, setEditForm] = useState({
    itemName: '',
    description: '',
    category: '',
    subcategory: '',
    origin: ''
  })

  // Get filtered and sorted items
  const { filteredAndSortedList, getFilteredItems } = useItemFilters(list, {
    searchQuery,
    selectedCategories,
    selectedSubcategories,
    selectedSources,
    selectedGifted,
    selectedMaterials,
    sortOrder
  })

  // Restore scroll position from sessionStorage on mount
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('inventoryScrollPosition')
    if (savedScrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10))
      }, 100)
      sessionStorage.removeItem('inventoryScrollPosition')
    }
  }, [])

  // Callback when a new item is created via ItemForm
  const handleItemCreated = (newItem) => {
    setList([newItem, ...list])
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

  // Save scroll position and view mode before navigating to item detail
  const navigateToItem = (itemId, editMode = false) => {
    sessionStorage.setItem('inventoryScrollPosition', window.scrollY.toString())
    sessionStorage.setItem('inventoryViewMode', viewMode)
    navigate(`/item/${itemId}${editMode ? '?edit=true' : ''}`)
  }

  // Calculate active filter count
  const activeFilterCount = selectedCategories.length + selectedSubcategories.length + selectedSources.length + (selectedGifted !== null ? 1 : 0) + selectedMaterials.length

  const clearAllFilters = () => {
    setSelectedCategories([])
    setSelectedSubcategories([])
    setSelectedSources([])
    setSelectedGifted(null)
    setSelectedMaterials([])
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100">

      {/* Header */}
      <div className="mb-6">
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

      {/* Sort controls - only in list view, on its own line */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm">Sort by:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-fit px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">A-Z</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder('random')}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
          >
            Randomize
          </button>
        </div>
      )}

      {/* Filters, Search, and View Toggle */}
      <div className="flex gap-4 items-center mb-4">
        {/* Filters toggle button */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            showFilters || activeFilterCount > 0
              ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          Filters {showFilters ? '▼' : '▶'}
          {activeFilterCount > 0 && (
            <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear all filters button */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Clear all
          </button>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
        />

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 border rounded-l-lg transition-all ${
              viewMode === 'list'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            title="List view"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cloud')}
            className={`px-3 py-2 border rounded-r-lg transition-all ${
              viewMode === 'cloud'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            title="Cloud view"
          >
            ✦
          </button>
        </div>
      </div>

      {/* Collapsible Filters Section */}
      <FilterPanel
        showFilters={showFilters}
        availableCategories={availableCategories}
        availableSubcategories={availableSubcategories}
        availableMaterials={availableMaterials}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        selectedSubcategories={selectedSubcategories}
        setSelectedSubcategories={setSelectedSubcategories}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        selectedGifted={selectedGifted}
        setSelectedGifted={setSelectedGifted}
        selectedMaterials={selectedMaterials}
        setSelectedMaterials={setSelectedMaterials}
        getFilteredItems={getFilteredItems}
      />

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

      {/* View Content */}
      {viewMode === 'cloud' ? (
        <CloudView
          items={list}
          filteredItems={filteredAndSortedList}
          availableCategories={availableCategories}
          isAdmin={isAdmin}
          onNavigate={navigateToItem}
          token={token}
          onItemUpdate={(itemId, updates) => {
            setList(list.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            ))
          }}
        />
      ) : (
        <>
          {/* Table - Desktop */}
          <ItemTable
            items={filteredAndSortedList}
            isAdmin={isAdmin}
            token={token}
            editingIndex={editingIndex}
            editForm={editForm}
            setEditForm={setEditForm}
            onNavigate={navigateToItem}
            onDelete={handleDelete}
          />

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredAndSortedList.map((item, index) => (
              <ItemCard
                key={index}
                item={item}
                index={index}
                isAdmin={isAdmin}
                token={token}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                onDelete={handleDelete}
                onNavigate={navigateToItem}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Home
