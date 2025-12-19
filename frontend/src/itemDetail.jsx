import { useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import PrivateText from './PrivateText.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

// CORRECTED: Added token to prop destructuring
function ItemDetail({ list, setList, token }) { 
  const { id } = useParams()
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

  if (!item) {
    return <p>Item not found</p>
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // ADDED: Check if user is logged in before attempting upload
    if (!token) {
        console.error("User not logged in. Cannot upload photo.")
        setUploading(false)
        return
    }

    setUploading(true)

    const formData = new FormData()
    formData.append('photo', file)

    const response = await fetch(`${API_URL}/item/${id}/photo`, {
      method: 'POST',
      body: formData,
      headers: { // ADDED: Authorization header
          'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) { // Only update state if API call succeeds
        const result = await response.json()
        
        // Update the item in local state so UI refreshes
        const updatedList = list.map(i => 
          i.id === id ? { ...i, mainPhoto: result.url } : i
        )
        setList(updatedList)
    } else {
        console.error("Photo upload failed.", await response.text())
        // Optionally: Handle 401 or other errors
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
    <div>
  {isEditing ? (
  <input 
    type="text"
    value={editName}
    onChange={(e) => setEditName(e.target.value)}
  />
) : (
  <h1>{item.itemName}</h1>
)}
      
      <div className="photo-section">
        {/* ADDED: Conditional logic for click handler and cursor based on token */}
        <div 
          className="main-photo" 
          onClick={token ? () => document.getElementById('photo-input').click() : undefined}
          style={{cursor: token ? 'pointer' : 'default'}}
        >
          {item.mainPhoto ? (
            <img src={item.mainPhoto} alt={item.itemName} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          ) : (
             // UPDATED: Text based on login status
            <p>{uploading ? 'Uploading...' : (token ? 'Click to add photo' : 'No photo added')}</p>
          )}
        </div>
        
        {/* ADDED: Conditionally render the input element only if logged in */}
        {token && (
          <input 
            type="file" 
            id="photo-input" 
            accept="image/*" 
            onChange={handlePhotoUpload}
            style={{display: 'none'}}
          />
        )}
      </div>

<div className="item-info">
  <p><strong>Description:</strong> {isEditing ? (
    <textarea 
      value={editDescription}
      onChange={(e) => setEditDescription(e.target.value)}
      placeholder="Use ||text|| to mark private sections"
    />
  ) : (
    <PrivateText text={item.description} isAuthenticated={!!token} />
  )}</p>

  <p><strong>Category:</strong> {isEditing ? (
    <select
      value={editCategory}
      onChange={(e) => setEditCategory(e.target.value)}
    >
      <option value="clothing">Clothing</option>
      <option value="jewelry">Jewelry</option>
      <option value="sentimental">Sentimental</option>
      <option value="bedding">Bedding</option>
      <option value="other">Other</option>
    </select>
  ) : (
    item.category
  )}</p>

  {(isEditing ? editCategory : item.category) === 'clothing' && (
    <p><strong>Subcategory:</strong> {isEditing ? (
      <select
        value={editSubcategory}
        onChange={(e) => setEditSubcategory(e.target.value)}
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
      item.subcategory
    )}</p>
  )}

  <p><strong>Origin:</strong> {isEditing ? (
    <input 
      type="text"
      value={editOrigin}
      onChange={(e) => setEditOrigin(e.target.value)}
    />
  ) : (
    item.origin
  )}</p>

  <p><strong>Date logged:</strong> {new Date(item.createdAt + 'Z').toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}</p>
</div>
{isEditing ? (
  <button onClick={handleSave}>Save</button>
) : (
  token && <button onClick={() => setIsEditing(true)}>Edit</button>
)}
<button onClick={() => window.history.back()}>Back</button>

    </div>
  )
}

export default ItemDetail
