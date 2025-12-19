import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PrivateText from './PrivateText.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

// UPDATED: Added new props for login management (setShowLogin, handleLogout)
function Home({ list, setList, token, setShowLogin, handleLogout }) {
  // Refs for form field navigation
  const itemNameRef = useRef(null)
  const descriptionRef = useRef(null)
  const categoryRef = useRef(null)
  const originRef = useRef(null)
  const photoRef = useRef(null)
  const submitRef = useRef(null)

  // State for form inputs
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [origin, setOrigin] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [sortOrder, setSortOrder] = useState('newest')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [errors, setErrors] = useState({
    itemName: false,
    description: false,
    origin: false,
    category: false
  })
  const [confirmDelete, setConfirmDelete] = useState(null)

const [editForm, setEditForm] = useState({
  itemName: '',
  description: '',
  category: '',
  subcategory: '',
  origin: ''
})
  // Helper function to handle Enter key navigation
  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (nextRef?.current) {
        nextRef.current.focus()
      }
    }
  }

const handlePhotoSelect = (e) => {
  const file = e.target.files[0]
  if (file) {
    setPhotoFile(file)
    const previewUrl = URL.createObjectURL(file)
    setPhotoPreview(previewUrl)
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

  setIsUploading(true)  // Start loading

  const formData = new FormData()
  formData.append('id', crypto.randomUUID())
  formData.append('itemName', itemName)
  formData.append('description', description)
  formData.append('category', category)
  formData.append('subcategory', subcategory)
  formData.append('origin', origin)


  if (photoFile) {
    formData.append('photo', photoFile)
  }

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

    // Clear form
    setItemName('')
    setDescription('')
    setCategory('other')
    setSubcategory('')
    setOrigin('')
    setPhotoFile(null)
    setPhotoPreview(null)
  } else {
    console.error("Failed to add item.", await response.text())
  }

  setIsUploading(false)  // End loading
}
  
const handleEdit = (index) => {
  const item = list[index]
  setEditForm({
    id: item.id,
    itemName: item.itemName,
    description: item.description,
    category: item.category,
    subcategory: item.subcategory,
    origin: item.origin
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
  
  console.log('deleting item:', itemToDelete.itemName)
  
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
    // Check if user is logged in before attempting PUT operation
    if (!token) {
        console.error("User not logged in. Cannot save item.")
        return
    }

  const response = await fetch(`${API_URL}/item/${editForm.id}`, {
    method: 'PUT',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // ADDED: Authorization header
    },
    body: JSON.stringify(editForm)
  })

  if (response.ok) { // Only update state if API call succeeds
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
  
const filteredAndSortedList = list
  .filter(item => {
    if (selectedCategories.length === 0) return true
    return selectedCategories.includes(item.category)
  })
  .sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt)
    } else {
      return new Date(a.createdAt) - new Date(b.createdAt)
    }
  })

  
  return (
    <div>
      {/* NEW: Flex container for H1 and Login/Logout button, aligned horizontally */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Bradie's Inventory</h1>
        
        {/* MOVED: The functional Login/Logout button logic */}
        <div className="home-auth-button">
            {token ? (
              <button onClick={handleLogout}>Logout</button>
            ) : (
              <button onClick={() => setShowLogin(true)}>Login</button>
            )}
        </div>
      </div>
      
      {/* NEW LOCATION: Blurb conditional block placed below the new header div, without box styling */}
      {!token && (
        <div style={{marginBottom: '20px'}}>
          <p>This is my inventory of items, created for performance art, to learn to code, to create a portfolio, and to keep track of the items that I have.</p>
          <p>If the inventory does not yet display items, wait 50 seconds and refresh the page.</p>
        </div>
      )}

{token && ( 
  <form>
    <div>
      <label>Item Name:</label>
      <input 
        type="text"
        ref={itemNameRef}
        value={itemName}
        onChange={(e) => {
          setItemName(e.target.value)
          setErrors({...errors, itemName: false})
        }}
        style={{ borderColor: errors.itemName ? 'red' : '' }}
        onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
        enterKeyHint="next"
      />
       {errors.itemName && <span style={{color: 'red', fontSize: '12px'}}>Required</span>}
    </div>

    <div>
      <label>Description:</label>
      <textarea 
        ref={descriptionRef}
        value={description}
        onChange={(e) => {
          setDescription(e.target.value)
          setErrors({...errors, description: false})
        }}
        style={{ borderColor: errors.description ? 'red' : '' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            originRef.current?.focus()
          }
        }}
        enterKeyHint="next"
        placeholder="Use || text || to mark private sections"
      />
       {errors.description && <span style={{color: 'red', fontSize: '12px'}}>Required</span>}
    </div>

    <div>
      <label>Origin:</label>
      <input 
        type="text"
        ref={originRef}
        value={origin}
        onChange={(e) => {
          setOrigin(e.target.value)
          setErrors({...errors, origin: false})
        }}
        style={{ borderColor: errors.origin ? 'red' : '' }}
        onKeyDown={(e) => handleKeyDown(e, categoryRef)}
        enterKeyHint="next"
      />
       {errors.origin && <span style={{color: 'red', fontSize: '12px'}}>Required</span>}
    </div>

<div>
  <label>Category:</label>
  <select 
    ref={categoryRef}
    value={category}
    onChange={(e) => {
      setCategory(e.target.value)
      setErrors({...errors, category: false})
    }}
    style={{ borderColor: errors.category ? 'red' : '' }}
  >
    <option value="">-- Select --</option>
    <option value="clothing">Clothing</option>
    <option value="jewelry">Jewelry</option>
    <option value="sentimental">Sentimental</option>
    <option value="bedding">Bedding</option>
    <option value="other">Other</option>
  </select>
  {errors.category && <span style={{color: 'red', fontSize: '12px'}}>Required</span>}
</div>

    {category === 'clothing' && (
      <div>
        <label>Subcategory:</label>
        <select
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
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

    <div>
      <label>Photo:</label>
      <input 
        type="file"
        ref={photoRef}
        accept="image/*"
        onChange={handlePhotoSelect}
      />
      {photoPreview && (
        <div style={{marginTop: '10px'}}>
          <img 
            src={photoPreview} 
            alt="Preview" 
            style={{width: '200px', height: '200px', objectFit: 'cover'}}
          />
        </div>
      )}
    </div>

    <button 
      type="button" 
      ref={submitRef}
      onClick={handleAddItem}
      disabled={isUploading}
    >
      {isUploading ? 'Adding...' : 'Add Item'}
    </button>
  </form>
)}

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>My Items</h2>
        {/* Conditionally render Undo button only if logged in */}
        {deletedHistory.length > 0 && token && (
          <button onClick={handleUndo}>Undo Delete</button>
        )}
      </div>

<div style={{display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap'}}>
  <div>
    <label>Sort by: </label>
    <select 
      value={sortOrder} 
      onChange={(e) => setSortOrder(e.target.value)}
    >
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
    </select>
  </div>
  
  <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
    {['clothing', 'jewelry', 'sentimental', 'bedding', 'other'].map(cat => (
      <button
        key={cat}
        onClick={() => {
          if (selectedCategories.includes(cat)) {
            setSelectedCategories(selectedCategories.filter(c => c !== cat))
          } else {
            setSelectedCategories([...selectedCategories, cat])
          }
        }}
        style={{
          padding: '8px 16px',
          backgroundColor: selectedCategories.includes(cat) ? '#4CAF50' : '#e0e0e0',
          color: selectedCategories.includes(cat) ? 'white' : '#333',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {cat.charAt(0).toUpperCase() + cat.slice(1)}
      </button>
    ))}
  </div>
</div>


      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Item Name</th>
            <th>Description</th>
            <th>Category</th>
            <th>Origin</th>
            {/* Conditionally render Actions column header only if logged in */}
            {token && <th>Actions</th>} 
          </tr>
        </thead>
        <tbody>
  {filteredAndSortedList.map((item, index) => (
<tr 
  key={index} 
  onClick={() => {
    if (editingIndex !== index) {
      navigate(`/item/${item.id}`)
    }
  }} 
  style={{cursor: editingIndex === index ? 'default' : 'pointer'}}
>
<td onClick={(e) => e.stopPropagation()}>
  {item.mainPhoto ? (
    <img src={item.mainPhoto} alt={item.itemName} className="table-thumbnail" />
  ) : (
      <div className="table-thumbnail-empty">+</div>
  )}
</td>

              <td>
                {editingIndex === index ? (
                  <input 
                    value={editForm.itemName}
                    onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                  />
                ) : (
                  item.itemName
                )}
              </td>
              <td>
                {editingIndex === index ? (
                  <textarea 
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                ) : (
                    <span className="description-cell">
                      <PrivateText text={item.description} isAuthenticated={!!token} />
                    </span>
                )}
              </td>
            
              <td>
                {editingIndex === index ? (
                  <select 
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                  >
                    <option value="clothing">Clothing</option>
                    <option value="jewelry">Jewelry</option>
                    <option value="sentimental">Sentimental</option>
                    <option value="bedding">Bedding</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  item.category
                )}
              </td>
              <td>
                {editingIndex === index ? (
                  <input 
                    value={editForm.origin}
                    onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                  />
                ) : (
                  <span className="origin-cell">{item.origin}</span>
                )}
              </td>
              
              {/* Conditionally render Actions cell only if logged in */}
{token && (
  <td>
    <button onClick={(e) => {
      e.stopPropagation()
      navigate(`/item/${item.id}?edit=true`)
    }}>Edit</button>
<button onClick={(e) => {
  e.stopPropagation()
  handleDelete(item.id)
}}>Delete</button>
  </td>
)}

            </tr>
          ))}
        </tbody>
      </table>


      {/* Mobile card view */}
<div className="mobile-item-list">
  {filteredAndSortedList.map((item, index) => (
    <div 
      key={index} 
      className="mobile-item-card"
      onClick={() => navigate(`/item/${item.id}`)}
    >
      {item.mainPhoto && (
        <img src={item.mainPhoto} alt={item.itemName} />
      )}
      <div className="mobile-item-field">
        <strong>Name:</strong> {item.itemName}
      </div>
      <div className="mobile-item-field">
        <strong>Description:</strong> <PrivateText text={item.description} isAuthenticated={!!token} />
      </div>
      <div className="mobile-item-field">
        <strong>Category:</strong> {item.category}
      </div>
      <div className="mobile-item-field">
        <strong>Origin:</strong> {item.origin}
      </div>
      
{token && (
  <div style={{marginTop: '10px'}} onClick={(e) => e.stopPropagation()}>
    <button onClick={() => navigate(`/item/${item.id}?edit=true`)}>Edit</button>
    
    {confirmDelete === item.id ? (
      <div>
        <span style={{marginRight: '10px'}}>Are you sure?</span>
        <button onClick={() => {
          handleDelete(item.id)
          setConfirmDelete(null)
        }}>Yes</button>
        <button onClick={() => setConfirmDelete(null)} style={{marginLeft: '5px'}}>No</button>
      </div>
) : (
      <button onClick={() => setConfirmDelete(item.id)} style={{marginLeft: '5px'}}>Delete</button>
    )}
  </div>
)}
    </div>
  ))}
</div>
</div>
  )
}

export default Home
