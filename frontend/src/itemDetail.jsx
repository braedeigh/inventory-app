import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import PrivateText from './PrivateText.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function ItemDetail({ list, setList, token }) { 
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const startInEditMode = searchParams.get('edit') === 'true'
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const item = list.find(item => item.id === id)
  const [uploading, setUploading] = useState(false)

  const [editName, setEditName] = useState(item?.itemName || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editCategory, setEditCategory] = useState(item?.category || '')
  const [editSubcategory, setEditSubcategory] = useState(item?.subcategory || '')
  const [editOrigin, setEditOrigin] = useState(item?.origin || '')
  const [editSecondhand, setEditSecondhand] = useState(item?.secondhand || '')

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
    const file = e.target.files[0]
    if (!file) return

    if (!token) {
      console.error("User not logged in. Cannot upload photo.")
      return
    }

    setUploading(true)

    const formData = new FormData()
    formData.append('photo', file)

    const response = await fetch(`${API_URL}/item/${id}/photo`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const result = await response.json()
      const updatedList = list.map(i => 
        i.id === id ? { ...i, mainPhoto: result.url } : i
      )
      setList(updatedList)
    } else {
      console.error("Photo upload failed.", await response.text())
    }
    
    setUploading(false)
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
      })
    })

    if (response.ok) {
      const updatedItem = await response.json()
      const updatedList = list.map(i => 
        i.id === id ? updatedItem : i
      )
      setList(updatedList)
      setIsEditing(false)
    } else {
      console.error("Failed to save.", await response.text())
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 text-neutral-800 dark:text-neutral-100 max-w-4xl mx-auto">
      
      {/* Header with Back and Edit/Save buttons */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate('/inventory')}
          className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        >
          ← Back to Inventory
        </button>

        {isEditing ? (
          <div className="flex gap-2">
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
            >
              Save
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          token && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-blue-200 text-black rounded-lg hover:bg-blue-300 transition-all"
            >
              Edit
            </button>
          )
        )}
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
          <div 
            className={`aspect-square rounded-xl overflow-hidden border-2 border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 ${token ? 'cursor-pointer hover:border-green-500' : ''}`}
            onClick={token ? () => document.getElementById('photo-input').click() : undefined}
          >
            {item.mainPhoto ? (
              <img 
                src={item.mainPhoto} 
                alt={item.itemName} 
                className="w-full h-full object-cover"
              />
            ) : (
              <p className="text-neutral-400">
                {uploading ? 'Uploading...' : (token ? 'Click to add photo' : 'No photo')}
              </p>
            )}
          </div>
          
          {token && (
            <input 
              type="file" 
              id="photo-input" 
              accept="image/*" 
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
                <option value="gifted">Gifted</option>
                <option value="handmade">Handmade</option>
                <option value="unknown">Unknown</option>
              </select>
            ) : (
              <p className="capitalize">{item.secondhand || '—'}</p>
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

        </div>
      </div>
    </div>
  )
}

export default ItemDetail