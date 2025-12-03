import { useParams } from 'react-router-dom'
import { useState } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function ItemDetail({ list, setList }) {
  const { id } = useParams()
  const item = list.find(item => item.id === id)
  const [uploading, setUploading] = useState(false)

  if (!item) {
    return <p>Item not found</p>
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    const formData = new FormData()
    formData.append('photo', file)

    const response = await fetch(`${API_URL}/item/${id}/photo`, {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    
    // Update the item in local state so UI refreshes
    const updatedList = list.map(i => 
      i.id === id ? { ...i, mainPhoto: result.url } : i
    )
    setList(updatedList)
    
    setUploading(false)
  }

  return (
    <div>
      <h1>{item.itemName}</h1>
      
      <div className="photo-section">
        <div className="main-photo" onClick={() => document.getElementById('photo-input').click()}>
          {item.mainPhoto ? (
            <img src={item.mainPhoto} alt={item.itemName} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          ) : (
            <p>{uploading ? 'Uploading...' : 'Click to add photo'}</p>
          )}
        </div>
        <input 
          type="file" 
          id="photo-input" 
          accept="image/*" 
          onChange={handlePhotoUpload}
          style={{display: 'none'}}
        />
      </div>

      <div className="item-info">
        <p><strong>Description:</strong> {item.description}</p>
        <p><strong>Category:</strong> {item.category}</p>
        <p><strong>Origin:</strong> {item.origin}</p>
        <p><strong>New Purchase:</strong> {item.isNewPurchase ? 'Yes' : 'No'}</p>
      </div>

      <button onClick={() => window.history.back()}>Back</button>
    </div>
  )
}

export default ItemDetail