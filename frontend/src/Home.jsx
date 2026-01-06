import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PrivateText from './PrivateText.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Home({ list, setList, token, setShowLogin, handleLogout }) {
  const itemNameRef = useRef(null)
  const descriptionRef = useRef(null)
  const categoryRef = useRef(null)
  const originRef = useRef(null)
  const photoRef = useRef(null)
  const submitRef = useRef(null)

  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [origin, setOrigin] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0)
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [sortOrder, setSortOrder] = useState('newest')
  const [randomKey, setRandomKey] = useState(0) // Used to force re-randomization
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGifted, setSelectedGifted] = useState(null) // null = all, true = gifted only, false = not gifted only
  const [errors, setErrors] = useState({
    itemName: false,
    description: false,
    origin: false,
    category: false
  })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [secondhand, setSecondhand] = useState('')
  const [gifted, setGifted] = useState(false)
  const [privateItem, setPrivateItem] = useState(false)

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

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (nextRef?.current) {
        nextRef.current.focus()
      }
    }
  }

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      // Limit to 5 photos total
      const newFiles = files.slice(0, 5 - photoFiles.length)
      const newPreviews = newFiles.map(file => URL.createObjectURL(file))

      setPhotoFiles(prev => [...prev, ...newFiles].slice(0, 5))
      setPhotoPreviews(prev => [...prev, ...newPreviews].slice(0, 5))
    }
  }

  const removePhoto = (index) => {
    // Revoke the URL to free memory
    URL.revokeObjectURL(photoPreviews[index])

    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))

    // Adjust main photo index if needed
    if (mainPhotoIndex === index) {
      setMainPhotoIndex(0)
    } else if (mainPhotoIndex > index) {
      setMainPhotoIndex(prev => prev - 1)
    }
  }

  const handleAddItem = async () => {
    if (!token) {
      console.error("User not logged in. Cannot add item.")
      return
    }

    if (itemName === '' || description === '' || origin === '' || category === '') {
      setErrors({
        itemName: itemName === '',
        description: description === '',
        origin: origin === '',
        category: category === ''
      })
      return
    }

    setIsUploading(true)

    const formData = new FormData()
    formData.append('id', crypto.randomUUID())
    formData.append('itemName', itemName)
    formData.append('description', description)
    formData.append('category', category)
    formData.append('subcategory', subcategory)
    formData.append('origin', origin)
    formData.append('secondhand', secondhand)
    formData.append('gifted', gifted ? 'true' : 'false')
    formData.append('private', privateItem ? 'true' : 'false')
    formData.append('mainPhotoIndex', mainPhotoIndex)

    // Append all photos
    photoFiles.forEach((file) => {
      formData.append('photos', file)
    })

    const response = await fetch(`${API_URL}/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (response.ok) {
      const newItem = await response.json()
      setList([newItem, ...list])
      setItemName('')
      setDescription('')
      setCategory('other')
      setSubcategory('')
      setOrigin('')
      setSecondhand('')
      setGifted(false)
      setPrivateItem(false)
      setPhotoFiles([])
      setPhotoPreviews([])
      setMainPhotoIndex(0)
    } else {
      console.error("Failed to add item.", await response.text())
    }

    setIsUploading(false)
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
  
  const filteredAndSortedList = list
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
<form className="w-full md:w-3/4 mx-auto mb-10 p-4 md:p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Item Name:</label>
            <input 
              type="text"
              ref={itemNameRef}
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value)
                setErrors({...errors, itemName: false})
              }}
              className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.itemName ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
              onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
            />
            {errors.itemName && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Description:</label>
            <textarea 
              ref={descriptionRef}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setErrors({...errors, description: false})
              }}
              className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px] ${errors.description ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  originRef.current?.focus()
                }
              }}
              placeholder="Use || text || to mark private sections"
            />
            {errors.description && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Origin:</label>
            <input 
              type="text"
              ref={originRef}
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value)
                setErrors({...errors, origin: false})
              }}
              className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.origin ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
              onKeyDown={(e) => handleKeyDown(e, categoryRef)}
            />
            {errors.origin && <span className="text-red-500 text-xs">Required</span>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Category:</label>
            <select 
              ref={categoryRef}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setErrors({...errors, category: false})
              }}
              className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.category ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`}
            >
              <option value="">-- Select --</option>
              <option value="clothing">Clothing</option>
              <option value="jewelry">Jewelry</option>
              <option value="sentimental">Sentimental</option>
              <option value="bedding">Bedding</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <span className="text-red-500 text-xs">Required</span>}
          </div>

          {category === 'clothing' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Subcategory:</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2 text-base border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Select --</option>
                <option value="undershirt">Undershirt</option>
                <option value="shirt">Shirt</option>
                <option value="sweater">Sweater</option>
                <option value="jacket">Jacket</option>
                <option value="dress">Dress</option>
                <option value="pants">Pants</option>
                <option value="shorts">Shorts</option>
                <option value="skirt">Skirt</option>
                <option value="shoes">Shoes</option>
                <option value="socks">Socks</option>
                <option value="underwear">Underwear</option>
                <option value="accessories">Accessories</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">New or Secondhand:</label>
            <select
              value={secondhand}
              onChange={(e) => setSecondhand(e.target.value)}
              className="w-full px-3 py-2 text-base border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select --</option>
              <option value="new">New</option>
              <option value="secondhand">Secondhand</option>
              <option value="handmade">Handmade</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="mb-4 flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gifted}
                onChange={(e) => setGifted(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium">Gifted?</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privateItem}
                onChange={(e) => setPrivateItem(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium">Private?</span>
            </label>
          </div>

<div className="mb-4">
  <label className="block text-sm font-medium mb-1">Photos (up to 5):</label>

  {/* Hidden file input */}
  <input
    type="file"
    ref={photoRef}
    accept="image/*"
    multiple
    onChange={handlePhotoSelect}
    className="hidden"
  />

  {/* Styled button that triggers the file input */}
  {photoFiles.length < 5 && (
    <button
      type="button"
      onClick={() => photoRef.current?.click()}
      className="w-full md:w-auto px-4 py-3 md:py-2 text-base bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all border border-neutral-300 dark:border-neutral-600"
    >
      {photoFiles.length === 0 ? 'Choose Photos' : 'Add More Photos'}
    </button>
  )}

  {/* Photo count */}
  {photoFiles.length > 0 && (
    <span className="block md:inline mt-2 md:mt-0 md:ml-2 text-sm text-neutral-500">
      {photoFiles.length}/5 photos selected
    </span>
  )}

  {/* Photo previews grid */}
  {photoPreviews.length > 0 && (
    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
      {photoPreviews.map((preview, index) => (
        <div
          key={index}
          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
            mainPhotoIndex === index
              ? 'border-green-500 ring-2 ring-green-500/50'
              : 'border-transparent hover:border-neutral-400'
          }`}
          onClick={() => setMainPhotoIndex(index)}
        >
          <img
            src={preview}
            alt={`Preview ${index + 1}`}
            className="w-full aspect-square object-cover"
          />
          {/* Main badge */}
          {mainPhotoIndex === index && (
            <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
              Main
            </div>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removePhoto(index)
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}

  {photoPreviews.length > 0 && (
    <p className="mt-2 text-xs text-neutral-500">
      Click a photo to set it as the main photo
    </p>
  )}
</div>

          <button 
            type="button" 
            ref={submitRef}
            onClick={handleAddItem}
            disabled={isUploading}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {isUploading ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      {/* My Items Header */}
      <div className="flex justify-between items-center mb-4 mt-10">
        <h2 className="text-3xl font-light text-green-700 dark:text-green-500">My Items</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center mb-6">
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
        
        <div className="flex flex-wrap gap-2">
          {['clothing', 'jewelry', 'sentimental', 'bedding', 'other'].map(cat => {
            const count = list.filter(item => item.category === cat).length
            return (
<button
  key={cat}
  onClick={() => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat))
    } else {
      setSelectedCategories([...selectedCategories, cat])
    }
  }}
  className={`filter-button ${selectedCategories.includes(cat) ? 'active' : ''}`}
>
  {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
</button>
            )
          })}
        </div>
      </div>

      {/* Subcategory filters */}
      {selectedCategories.includes('clothing') && (
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Uncategorized filter */}
          {(() => {
            const uncategorizedCount = list.filter(item => item.category === 'clothing' && (!item.subcategory || item.subcategory === '')).length
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
          {['undershirt', 'shirt', 'sweater', 'jacket', 'dress', 'pants', 'shorts', 'skirt', 'shoes', 'socks', 'underwear', 'accessories', 'other'].map(sub => {
            const count = list.filter(item => item.category === 'clothing' && item.subcategory === sub).length
            return (
<button
  key={sub}
  onClick={() => {
    if (selectedSubcategories.includes(sub)) {
      setSelectedSubcategories(selectedSubcategories.filter(s => s !== sub))
    } else {
      setSelectedSubcategories([...selectedSubcategories, sub])
    }
  }}
  className={`filter-button-sub ${selectedSubcategories.includes(sub) ? 'active' : ''}`}
>
  {sub.charAt(0).toUpperCase() + sub.slice(1)} ({count})
</button>
            )
          })}
        </div>
      )}

      {/* Divider */}
      <hr className="border-neutral-300 dark:border-neutral-600 mb-4" />

      {/* Source filters (new/secondhand/handmade/unknown) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['new', 'secondhand', 'handmade', 'unknown'].map(source => {
          const count = list.filter(item => item.secondhand === source).length
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

      {/* Divider */}
      <hr className="border-neutral-300 dark:border-neutral-600 mb-4" />

      {/* Gifted filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedGifted(selectedGifted === true ? null : true)}
          className={`filter-button-sub ${selectedGifted === true ? 'active' : ''}`}
        >
          Gifted ({list.filter(item => item.gifted === 'true' || item.gifted === true).length})
        </button>
        <button
          onClick={() => setSelectedGifted(selectedGifted === false ? null : false)}
          className={`filter-button-sub ${selectedGifted === false ? 'active' : ''}`}
        >
          Not Gifted ({list.filter(item => item.gifted !== 'true' && item.gifted !== true).length})
        </button>
      </div>

      {/* Undo Delete button */}
      {deletedHistory.length > 0 && token && (
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
    {token && <th className="p-3 text-left w-38">Actions</th>}
  </tr>
</thead>
          <tbody>
            {filteredAndSortedList.map((item, index) => {
              const isPrivate = (item.private === 'true' || item.private === true) && !token
              return (
              <tr
                key={index}
                onClick={() => {
                  if (editingIndex !== index) {
                    navigateToItem(item.id)
                  }
                }}
                className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <td className="p-3 w-16" onClick={(e) => e.stopPropagation()}>
                  {item.mainPhoto ? (
                    <img src={item.mainPhoto} alt={item.itemName} className={`w-12 h-12 object-cover rounded ${isPrivate ? 'blur-md' : ''}`} />
                  ) : (
                    <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center text-neutral-400">+</div>
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
                    <span className={`block truncate ${isPrivate ? 'blur-sm' : ''}`}>{item.itemName}</span>
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
                    <span className={`block truncate ${isPrivate ? 'blur-sm' : ''}`}>
                      <PrivateText text={item.description} isAuthenticated={!!token} />
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
                    <span className={`block truncate ${isPrivate ? 'blur-sm' : ''}`}>{item.origin}</span>
                  )}
                </td>
                
                {token && (
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
          const isPrivate = (item.private === 'true' || item.private === true) && !token
          return (
          <div
            key={index}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 cursor-pointer"
            onClick={() => navigateToItem(item.id)}
          >
            {item.mainPhoto && (
              <img src={item.mainPhoto} alt={item.itemName} className={`w-full max-w-[200px] h-auto rounded-lg mb-3 ${isPrivate ? 'blur-lg' : ''}`} />
            )}
            <div className={`mb-2 ${isPrivate ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Name:</strong> {item.itemName}
            </div>
            <div className={`mb-2 ${isPrivate ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Description:</strong> <PrivateText text={item.description} isAuthenticated={!!token} />
            </div>
            <div className={`mb-2 ${isPrivate ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Category:</strong> {item.category}
            </div>
            <div className={`mb-2 ${isPrivate ? 'blur-sm' : ''}`}>
              <strong className="text-neutral-500 dark:text-neutral-400">Origin:</strong> {item.origin}
            </div>
            
            {token && (
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