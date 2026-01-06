import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PrivateText from './PrivateText.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function ItemDetail({ list, setList, token }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const startInEditMode = searchParams.get('edit') === 'true'
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const item = list.find(item => item.id === id)
  const [uploading, setUploading] = useState(false)

  // Photo gallery state
  const [photos, setPhotos] = useState([])
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [loadingPhotos, setLoadingPhotos] = useState(true)
  const [deletedPhotos, setDeletedPhotos] = useState([]) // For undo functionality - array of deleted photos
  const [undoing, setUndoing] = useState(false) // Loading state for undo

  const [editName, setEditName] = useState(item?.itemName || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editCategory, setEditCategory] = useState(item?.category || '')
  const [editSubcategory, setEditSubcategory] = useState(item?.subcategory || '')
  const [editOrigin, setEditOrigin] = useState(item?.origin || '')
  const [editSecondhand, setEditSecondhand] = useState(item?.secondhand || '')
  const [editGifted, setEditGifted] = useState(item?.gifted === 'true' || item?.gifted === true)

  // Fetch photos for this item
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await fetch(`${API_URL}/item/${id}/photos`)
        if (response.ok) {
          const data = await response.json()
          setPhotos(data.photos || [])
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error)
      }
      setLoadingPhotos(false)
    }

    if (id) {
      fetchPhotos()
    }
  }, [id])

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (!item) {
    return (
      <div className="min-h-screen px-4 py-10 text-neutral-800 dark:text-neutral-100">
        <p>Item not found</p>
        <button 
          onClick={() => navigate('/inventory')}
          className="mt-4 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg"
        >
          ← Back to Inventory
        </button>
      </div>
    )
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    if (!token) {
      console.error("User not logged in. Cannot upload photo.")
      return
    }

    // Check if we're at the limit
    if (photos.length >= 5) {
      alert('Maximum 5 photos allowed')
      return
    }

    setUploading(true)

    const formData = new FormData()
    // Only upload up to the remaining slots
    const filesToUpload = files.slice(0, 5 - photos.length)
    filesToUpload.forEach(file => formData.append('photos', file))

    const response = await fetch(`${API_URL}/item/${id}/photos`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const result = await response.json()
      // Add new photos to state
      setPhotos(prev => [...prev, ...result.photos])

      // Update mainPhoto in list if this was the first photo
      if (result.photos.length > 0 && photos.length === 0) {
        const updatedList = list.map(i =>
          i.id === id ? { ...i, mainPhoto: result.photos[0].url } : i
        )
        setList(updatedList)
      }
    } else {
      console.error("Photo upload failed.", await response.text())
    }

    setUploading(false)
  }

  const handleDeletePhoto = async (photoId) => {
    if (!token) return

    // Find the photo before removing
    const photoToDelete = photos.find(p => p.id === photoId)
    const deletedIndex = photos.findIndex(p => p.id === photoId)

    // Remove from UI immediately
    setPhotos(prev => prev.filter(p => p.id !== photoId))

    // Adjust selected index if needed
    if (selectedPhotoIndex >= photos.length - 1) {
      setSelectedPhotoIndex(Math.max(0, photos.length - 2))
    }

    // Store for undo (with original position) - add to array
    setDeletedPhotos(prev => [...prev, { ...photoToDelete, originalIndex: deletedIndex }])

    // Actually delete from backend
    const response = await fetch(`${API_URL}/item/${id}/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      // Update mainPhoto in list
      if (deletedIndex === 0 && photos.length > 1) {
        const newMainPhoto = photos[1]?.url || null
        const updatedList = list.map(i =>
          i.id === id ? { ...i, mainPhoto: newMainPhoto } : i
        )
        setList(updatedList)
      } else if (photos.length === 1) {
        const updatedList = list.map(i =>
          i.id === id ? { ...i, mainPhoto: null } : i
        )
        setList(updatedList)
      }
    }
  }

  const handleUndoDeletePhoto = async () => {
    if (deletedPhotos.length === 0 || !token || undoing) return

    setUndoing(true)

    // Get the most recently deleted photo
    const photoToRestore = deletedPhotos[deletedPhotos.length - 1]

    // Remove from deleted array immediately to prevent double-clicks
    setDeletedPhotos(prev => prev.slice(0, -1))

    // Re-upload the photo using its Cloudinary URL
    // We need to fetch the image and re-upload it
    try {
      const response = await fetch(photoToRestore.url)
      const blob = await response.blob()
      const file = new File([blob], 'restored-photo.jpg', { type: blob.type })

      const formData = new FormData()
      formData.append('photos', file)

      const uploadResponse = await fetch(`${API_URL}/item/${id}/photos`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (uploadResponse.ok) {
        const result = await uploadResponse.json()
        // Add the restored photo back
        setPhotos(prev => [...prev, ...result.photos])

        // Update mainPhoto if this was the first photo
        if (result.photos.length > 0 && photos.length === 0) {
          const updatedList = list.map(i =>
            i.id === id ? { ...i, mainPhoto: result.photos[0].url } : i
          )
          setList(updatedList)
        }
      }
    } catch (error) {
      console.error('Failed to restore photo:', error)
      // If failed, add back to deleted array
      setDeletedPhotos(prev => [...prev, photoToRestore])
    }

    setUndoing(false)
  }

  const handleSetMainPhoto = async (photoId) => {
    if (!token) return

    // Reorder so the selected photo becomes position 0
    const selectedPhoto = photos.find(p => p.id === photoId)
    const otherPhotos = photos.filter(p => p.id !== photoId)
    const newOrder = [selectedPhoto, ...otherPhotos]
    const photoIds = newOrder.map(p => p.id)

    const response = await fetch(`${API_URL}/item/${id}/photos/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ photoIds })
    })

    if (response.ok) {
      const result = await response.json()
      setPhotos(result.photos)
      setSelectedPhotoIndex(0)

      // Update mainPhoto in list
      const updatedList = list.map(i =>
        i.id === id ? { ...i, mainPhoto: selectedPhoto.url } : i
      )
      setList(updatedList)
    }
  }

  const handleSave = async () => {
    if (!token) {
      console.error("User not logged in. Cannot save.")
      return
    }

    const response = await fetch(`${API_URL}/item/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        itemName: editName,
        description: editDescription,
        category: editCategory,
        subcategory: editSubcategory,
        origin: editOrigin,
        secondhand: editSecondhand,
        gifted: editGifted ? 'true' : 'false',
      })
    })

    if (response.ok) {
      const updatedItem = await response.json()
      const updatedList = list.map(i =>
        i.id === id ? updatedItem : i
      )
      setList(updatedList)
      setIsEditing(false)
      setDeletedPhotos([]) // Clear undo history on save
    } else {
      console.error("Failed to save.", await response.text())
    }
  }

  const handleDelete = async () => {
    if (!token) {
      console.error("User not logged in. Cannot delete.")
      return
    }

    const response = await fetch(`${API_URL}/item/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      setList(list.filter(i => i.id !== id))
      navigate('/inventory')
    } else {
      console.error("Failed to delete.", await response.text())
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100 max-w-4xl mx-auto">

      {/* Delete confirmation banner at top */}
      {confirmDelete && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-center mb-3 font-medium">Are you sure you want to delete this item?</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleDelete}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-6 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header with Back and Edit/Save/Delete buttons */}
      <div className="mb-6">
        {/* Buttons row */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <button
            onClick={() => navigate('/inventory')}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            ← Back to Inventory
          </button>

          <div className="flex gap-2 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 md:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 md:px-6 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all"
                >
                  Cancel
                </button>
              </>
            ) : (
              token && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 md:px-6 py-2 bg-blue-200 text-black rounded-lg hover:bg-blue-300 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 md:px-6 py-2 bg-red-200 text-black rounded-lg hover:bg-red-300 transition-all"
                  >
                    Delete
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      {isEditing ? (
        <input 
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full text-3xl md:text-4xl font-light font-serif mb-6 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
        />
      ) : (
        <h1 className="text-3xl md:text-4xl font-light font-serif mb-6">{item.itemName}</h1>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Photo section */}
        <div>
          {/* Main photo display */}
          <div
            className={`aspect-square rounded-xl overflow-hidden border-2 border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 ${token && photos.length < 5 ? 'cursor-pointer hover:border-green-500' : ''}`}
            onClick={token && photos.length < 5 ? () => document.getElementById('photo-input').click() : undefined}
          >
            {loadingPhotos ? (
              <p className="text-neutral-400">Loading photos...</p>
            ) : photos.length > 0 ? (
              <div className="relative w-full h-full">
                <img
                  src={photos[selectedPhotoIndex]?.url || item.mainPhoto}
                  alt={item.itemName}
                  className="w-full h-full object-contain"
                />
                {/* Photo timestamp overlay */}
                {photos[selectedPhotoIndex]?.createdAt && (
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1.5 rounded-lg text-center">
                    <div>Photo uploaded:</div>
                    <div>{new Date(photos[selectedPhotoIndex].createdAt + 'Z').toLocaleString('en-US', {
                      timeZone: 'America/Chicago',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}</div>
                  </div>
                )}
              </div>
            ) : item.mainPhoto ? (
              <img
                src={item.mainPhoto}
                alt={item.itemName}
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-neutral-400">
                {uploading ? 'Uploading...' : (token ? 'Click to add photo' : 'No photo')}
              </p>
            )}
          </div>

          {/* Photo thumbnails */}
          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    selectedPhotoIndex === index
                      ? 'border-green-500 ring-2 ring-green-500/50'
                      : 'border-transparent hover:border-neutral-400'
                  }`}
                  onClick={() => setSelectedPhotoIndex(index)}
                >
                  <img
                    src={photo.url}
                    alt={`${item.itemName} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && (
                    <div className="absolute top-0.5 left-0.5 bg-green-500 text-white text-[10px] px-1 rounded">
                      Main
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Photo management buttons (when editing) */}
          {token && isEditing && photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPhotoIndex !== 0 && (
                <button
                  type="button"
                  onClick={() => handleSetMainPhoto(photos[selectedPhotoIndex].id)}
                  className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
                >
                  Set as Main
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeletePhoto(photos[selectedPhotoIndex].id)}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
              >
                Delete Photo
              </button>
            </div>
          )}

          {/* Undo delete photo button */}
          {(deletedPhotos.length > 0 || undoing) && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-center justify-between">
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                {undoing ? 'Restoring photo...' : `${deletedPhotos.length} photo${deletedPhotos.length > 1 ? 's' : ''} deleted`}
              </span>
              <button
                type="button"
                onClick={handleUndoDeletePhoto}
                disabled={undoing || deletedPhotos.length === 0}
                className="px-3 py-1.5 text-sm bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {undoing ? 'Undoing...' : 'Undo'}
              </button>
            </div>
          )}

          {/* Add more photos button */}
          {token && photos.length > 0 && photos.length < 5 && (
            <button
              type="button"
              onClick={() => document.getElementById('photo-input').click()}
              className="mt-3 w-full py-2 text-sm border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-green-500 hover:text-green-600 transition-all"
            >
              {uploading ? 'Uploading...' : `Add More Photos (${photos.length}/5)`}
            </button>
          )}

          {token && (
            <input
              type="file"
              id="photo-input"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          )}
        </div>

        {/* Details section */}
        <div className="space-y-4">
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Description</label>
            {isEditing ? (
              <textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Use ||text|| to mark private sections"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 min-h-[120px]"
              />
            ) : (
              <p><PrivateText text={item.description} isAuthenticated={!!token} /></p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Category</label>
            {isEditing ? (
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option value="clothing">Clothing</option>
                <option value="jewelry">Jewelry</option>
                <option value="sentimental">Sentimental</option>
                <option value="bedding">Bedding</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <p className="capitalize">{item.category}</p>
            )}
          </div>

          {/* Subcategory (only for clothing) */}
          {(isEditing ? editCategory : item.category) === 'clothing' && (
            <div>
              <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Subcategory</label>
              {isEditing ? (
                <select
                  value={editSubcategory}
                  onChange={(e) => setEditSubcategory(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
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
              ) : (
                <p className="capitalize">{item.subcategory}</p>
              )}
            </div>
          )}

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Source</label>
            {isEditing ? (
              <select
                value={editSecondhand}
                onChange={(e) => setEditSecondhand(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option value="">-- Select --</option>
                <option value="new">New</option>
                <option value="secondhand">Secondhand</option>
                <option value="handmade">Handmade</option>
                <option value="unknown">Unknown</option>
              </select>
            ) : (
              <p className="capitalize">{item.secondhand || '—'}</p>
            )}
          </div>

          {/* Gifted checkbox */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Gifted?</label>
            {isEditing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editGifted}
                  onChange={(e) => setEditGifted(e.target.checked)}
                  className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-green-600 focus:ring-green-500"
                />
                <span>This item was a gift</span>
              </label>
            ) : (
              <p>{item.gifted === 'true' || item.gifted === true ? 'Yes' : 'No'}</p>
            )}
          </div>

          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Origin</label>
            {isEditing ? (
              <input 
                type="text"
                value={editOrigin}
                onChange={(e) => setEditOrigin(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
              />
            ) : (
              <p>{item.origin}</p>
            )}
          </div>

          {/* Date logged */}
          <div>
            <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Date Logged</label>
            <p>{new Date(item.createdAt + 'Z').toLocaleString('en-US', {
              timeZone: 'America/Chicago',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}</p>
          </div>

          {/* Last Edited - only show if different from created */}
          {item.lastEdited && item.lastEdited !== item.createdAt && (
            <div>
              <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Last Edited</label>
              <p>{new Date(item.lastEdited + 'Z').toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}</p>
            </div>
          )}

        </div>
      </div>

      {/* Floating save button for mobile */}
      {isEditing && (
        <button
          onClick={handleSave}
          className="md:hidden fixed bottom-6 right-6 px-5 py-3 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 active:bg-green-800 transition-all font-medium z-50"
        >
          Save
        </button>
      )}
    </div>
  )
}

export default ItemDetail