import { useParams } from 'react-router-dom'
import { useState } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

// CORRECTED: Added token to prop destructuring
function ItemDetail({ list, setList, token }) { 
  const { id } = useParams()
  const item = list.find(item => item.id === id)
  const [uploading, setUploading] = useState(false)

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

  return (
    <div>
      <h1>{item.itemName}</h1>
      
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
        <p><strong>Description:</strong> {item.description}</p>
        <p><strong>Category:</strong> {item.category}</p>
        <p><strong>Origin:</strong> {item.origin}</p>
        <p><strong>New Purchase:</strong> {item.isNewPurchase ? 'Yes' : 'No'}</p>
        <p><strong>Added:</strong> {new Date(item.createdAt).toLocaleString('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: 'long', 
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
})}</p>
      </div>

      <button onClick={() => window.history.back()}>Back</button>
    </div>
  )
}

export default ItemDetail