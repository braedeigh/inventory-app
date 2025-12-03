import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Home({ list, setList }) {
  // State for form inputs
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [isNewPurchase, setIsNewPurchase] = useState(false)
  const [origin, setOrigin] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const navigate = useNavigate()


  const [editForm, setEditForm] = useState({
    itemName: '',
    description: '',
    category: '',
    isNewPurchase: false,
    origin: ''
  })

const handleAddItem = async () => {
  const newItem = {
    id: crypto.randomUUID(),
    itemName,
    description,
    category,
    isNewPurchase,
    origin
  }

  await fetch(`${API_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newItem)
  })

  setList([newItem, ...list])

  setItemName('')
  setDescription('')
  setCategory('other')
  setIsNewPurchase(false)
  setOrigin('')
}
  
    
  const handleEdit = (index) => {
    const item = list[index]
    setEditForm({
        id: item.id,
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      isNewPurchase: item.isNewPurchase,
      origin: item.origin
    })
    setEditingIndex(index)
  }

const handleDelete = async (index) => {
  console.log('deleting item at index:', index)
  const itemToDelete = list[index]
  console.log('item to delete:', itemToDelete)
  
  await fetch(`https://bradie-inventory-api.onrender.com/item/${itemToDelete.id}`, {
    method: 'DELETE'
  })

  const newHistory = [...deletedHistory, { item: itemToDelete, position: index }]
  console.log('new history:', newHistory)
  setDeletedHistory(newHistory)
  
  const updatedList = list.filter((item, i) => i !== index)
  setList(updatedList)
}

const handleUndo = async () => {
  if (deletedHistory.length === 0) return
  
  const lastDeleted = deletedHistory[deletedHistory.length - 1]
  
  // Re-add to database
  await fetch('https://bradie-inventory-api.onrender.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lastDeleted.item)
  })
  
  const newList = [...list]
  newList.splice(lastDeleted.position, 0, lastDeleted.item)
  setList(newList)
  
  setDeletedHistory(deletedHistory.slice(0, -1))
}

const handleSave = async () => {
  const response = await fetch(`https://bradie-inventory-api.onrender.com/item/${editForm.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editForm)
  })

  const updatedItem = await response.json()

  const updatedList = list.map(item => 
    item.id === editForm.id ? updatedItem : item
  )
  setList(updatedList)
  setEditingIndex(null)
}

  const handleCancel = () => {
    setEditingIndex(null)
  }

  
  return (
    <div>
      <h1>Bradie's Inventory</h1>
      
      <form>
        <div>
          <label>Item Name:</label>
          <input 
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
        </div>

        <div>
          <label>Description:</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label>Category:</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="clothing">Clothing</option>
            <option value="jewelry">Jewelry</option>
            <option value="sentimental">Sentimental</option>
            <option value="bedding">Bedding</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label>
            <input 
              type="checkbox"
              checked={isNewPurchase}
              onChange={(e) => setIsNewPurchase(e.target.checked)}
            />
            Purchased after building this site
          </label>
        </div>

        <div>
          <label>Origin (optional):</label>
          <input 
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
        </div>

        <button type="button" onClick={handleAddItem}>Add Item</button>
      </form>

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>My Items</h2>
        {deletedHistory.length > 0 && (
          <button onClick={handleUndo}>Undo Delete</button>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Item Name</th>
            <th>Description</th>
            <th>Category</th>
            <th>New Purchase</th>
            <th>Origin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, index) => (
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
                    <span className="description-cell">{item.description}</span>
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
                    type="checkbox"
                    checked={editForm.isNewPurchase}
                    onChange={(e) => setEditForm({...editForm, isNewPurchase: e.target.checked})}
                  />
                ) : (
                    item.isNewPurchase ? 'Yes' : 'No'
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
              <td>
                {editingIndex === index ? (
                  <>
<button onClick={(e) => {
  e.stopPropagation()
  handleSave()
}}>Save</button>

<button onClick={(e) => {
  e.stopPropagation()
  handleCancel()
}}>Cancel</button>
                  </>
                ) : (
                  <>
<button onClick={(e) => {
  e.stopPropagation()
  handleEdit(index)
}}>Edit</button>

<button onClick={(e) => {
  e.stopPropagation()
  handleDelete(index)
}}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}




export default Home