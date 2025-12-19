import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Landing({ list, communityList }) {
  const [randomMyItem, setRandomMyItem] = useState(null)
  const [randomCommunityItem, setRandomCommunityItem] = useState(null)
  const navigate = useNavigate()

  const refreshMyItem = () => {
    if (list && list.length > 0) {
      const randomIndex = Math.floor(Math.random() * list.length)
      setRandomMyItem(list[randomIndex])
    }
  }

  const refreshCommunityItem = () => {
    if (communityList && communityList.length > 0) {
      const randomIndex = Math.floor(Math.random() * communityList.length)
      setRandomCommunityItem(communityList[randomIndex])
    }
  }

  useEffect(() => {
    refreshMyItem()
    refreshCommunityItem()
  }, [list, communityList])

  // Helper component with requested layout: Description then Origin
  const CardContent = ({ item }) => (
    <div style={{ textAlign: 'left', marginTop: '10px' }}>
      <img 
        src={item.mainPhoto} 
        alt={item.itemName} 
        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} 
      />
      <h4 style={{ margin: '10px 0 5px 0' }}>{item.itemName}</h4>
      
      {/* Description is now first */}
      <p style={{ 
        fontSize: '0.85em', 
        color: '#666',
        margin: '0 0 10px 0',
        display: '-webkit-box',
        WebkitLineClamp: '3',
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden' 
      }}>
        {item.description}
      </p>

      {/* Origin is now below the description */}
      <p style={{ fontSize: '0.9em', margin: '0', color: '#555' }}>
        <strong>Origin:</strong> {item.origin}
      </p>
    </div>
  )

  return (
    <div className="landing-container" style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Bradie's Show and Tell</h1>
      <p style={{ maxWidth: '600px', margin: '0 auto 10px' }}>
        This is a performance art piece documenting my personal 
        belongings and ethical consumption. My goal is to build this into a community resource
        for sharing favorite items and purchasing habits.
        Explore my inventory or see what others are sharing.
      </p>

      {/* Instruction text moved ABOVE the cards */}
      <p style={{ marginBottom: '20px', fontSize: '0.9em', color: '#4CAF50', fontWeight: 'bold' }}>
        Click an item to view a new random item
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* Personal Inventory Preview Card */}
        <div 
          className="preview-card" 
          onClick={refreshMyItem} 
          style={{ 
            cursor: 'pointer', border: '1px solid #4CAF50', padding: '20px', 
            borderRadius: '12px', width: '320px', backgroundColor: '#fff', color: '#333' 
          }}
        >
          <h3>My Inventory</h3>
          {randomMyItem ? <CardContent item={randomMyItem} /> : <div>Loading...</div>}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate('/inventory'); }}
            style={{ marginTop: '15px', width: '100%' }}
          >
            View Full Inventory
          </button>
        </div>

        {/* Community Preview Card */}
        <div 
          className="preview-card" 
          onClick={refreshCommunityItem} 
          style={{ 
            cursor: 'pointer', border: '1px solid #4CAF50', padding: '20px', 
            borderRadius: '12px', width: '320px', backgroundColor: '#fff', color: '#333' 
          }}
        >
          <h3>Community Show & Tell</h3>
          {randomCommunityItem ? <CardContent item={randomCommunityItem} /> : (
            <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {communityList && communityList.length === 0 ? "No community items yet" : "Loading..."}
            </div>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate('/community'); }}
            style={{ marginTop: '15px', width: '100%' }}
          >
            Explore Community
          </button>
        </div>
      </div>
    </div>
  )
}

export default Landing