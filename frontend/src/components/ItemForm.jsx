import { useState, useRef } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function ItemForm({
  token,
  availableMaterials,
  setAvailableMaterials,
  availableCategories,
  setAvailableCategories,
  availableSubcategories,
  setAvailableSubcategories,
  list,
  isAdmin,
  onItemCreated
}) {
  // Form refs
  const itemNameRef = useRef(null)
  const descriptionRef = useRef(null)
  const categoryRef = useRef(null)
  const originRef = useRef(null)
  const photoRef = useRef(null)
  const submitRef = useRef(null)

  // Form state
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [origin, setOrigin] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [errors, setErrors] = useState({
    itemName: false,
    description: false,
    origin: false,
    category: false
  })
  const [secondhand, setSecondhand] = useState('')
  const [gifted, setGifted] = useState(false)
  const [privateItem, setPrivateItem] = useState(false)
  const [privatePhotos, setPrivatePhotos] = useState(false)
  const [privateDescription, setPrivateDescription] = useState(false)
  const [privateOrigin, setPrivateOrigin] = useState(false)
  const [materials, setMaterials] = useState([])
  const [newMaterialName, setNewMaterialName] = useState('')

  // Categories management state
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showManageCategories, setShowManageCategories] = useState(false)

  // Subcategories management state
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [showManageSubcategories, setShowManageSubcategories] = useState(false)

  // AI Assistant state
  const [isAiExpanded, setIsAiExpanded] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [aiPhoto, setAiPhoto] = useState(null)
  const [aiPhotoPreview, setAiPhotoPreview] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiExtractedFields, setAiExtractedFields] = useState(null)

  // Helper to check if a field should be highlighted (AI was used but didn't fill it)
  const shouldHighlight = (fieldName) => {
    if (!aiExtractedFields) return false
    return !aiExtractedFields[fieldName]
  }

  // CSS class for AI-unfilled fields
  const aiUnfilledClass = 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/20'

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
      const newFiles = files.slice(0, 5 - photoFiles.length)
      const newPreviews = newFiles.map(file => URL.createObjectURL(file))

      setPhotoFiles(prev => [...prev, ...newFiles].slice(0, 5))
      setPhotoPreviews(prev => [...prev, ...newPreviews].slice(0, 5))
    }
  }

  const removePhoto = (index) => {
    URL.revokeObjectURL(photoPreviews[index])

    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))

    if (mainPhotoIndex === index) {
      setMainPhotoIndex(0)
    } else if (mainPhotoIndex > index) {
      setMainPhotoIndex(prev => prev - 1)
    }
  }

  // Material management functions
  const addMaterial = (materialName) => {
    if (materials.find(m => m.material === materialName)) return
    setMaterials([...materials, { material: materialName, percentage: null }])
  }

  const removeMaterial = (materialName) => {
    setMaterials(materials.filter(m => m.material !== materialName))
  }

  const updateMaterialPercentage = (materialName, percentage) => {
    setMaterials(materials.map(m =>
      m.material === materialName
        ? { ...m, percentage: percentage === '' ? null : parseInt(percentage) }
        : m
    ))
  }

  const addNewMaterial = async () => {
    if (!newMaterialName.trim() || !token) return
    try {
      const response = await fetch(`${API_URL}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newMaterialName })
      })
      if (response.ok) {
        const data = await response.json()
        if (!data.existed) {
          setAvailableMaterials([...availableMaterials, data].sort((a, b) => a.name.localeCompare(b.name)))
        }
        addMaterial(data.name)
        setNewMaterialName('')
      }
    } catch (err) {
      console.error('Failed to add material:', err)
    }
  }

  const deleteMaterialFromDb = async (materialId, materialName) => {
    if (!token) return
    const inUseCount = list.filter(item =>
      item.materials && item.materials.some(m => m.material === materialName)
    ).length
    if (inUseCount > 0) {
      alert(`Cannot delete "${materialName}" - it's used by ${inUseCount} item(s)`)
      return
    }
    try {
      const response = await fetch(`${API_URL}/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setAvailableMaterials(availableMaterials.filter(m => m.id !== materialId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete material')
      }
    } catch (err) {
      console.error('Failed to delete material:', err)
    }
  }

  // Category management functions
  const addNewCategory = async () => {
    if (!newCategoryName.trim() || !token) return
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategoryName })
      })
      if (response.ok) {
        const data = await response.json()
        if (!data.existed) {
          setAvailableCategories([...availableCategories, data].sort((a, b) => a.displayName.localeCompare(b.displayName)))
        }
        setNewCategoryName('')
      }
    } catch (err) {
      console.error('Failed to add category:', err)
    }
  }

  const deleteCategoryFromDb = async (categoryId, categoryName) => {
    if (!token) return
    const inUseCount = list.filter(item => item.category === categoryName).length
    if (inUseCount > 0) {
      alert(`Cannot delete "${categoryName}" - it's used by ${inUseCount} item(s)`)
      return
    }
    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setAvailableCategories(availableCategories.filter(c => c.id !== categoryId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete category')
      }
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  // Subcategory management functions
  const addNewSubcategory = async () => {
    if (!newSubcategoryName.trim() || !token) return
    try {
      const response = await fetch(`${API_URL}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newSubcategoryName, category: 'clothing' })
      })
      if (response.ok) {
        const data = await response.json()
        if (!data.existed) {
          setAvailableSubcategories([...availableSubcategories, data].sort((a, b) => a.displayName.localeCompare(b.displayName)))
        }
        setNewSubcategoryName('')
      }
    } catch (err) {
      console.error('Failed to add subcategory:', err)
    }
  }

  const deleteSubcategoryFromDb = async (subcategoryId, subcategoryName) => {
    if (!token) return
    const inUseCount = list.filter(item => item.subcategory === subcategoryName).length
    if (inUseCount > 0) {
      alert(`Cannot delete "${subcategoryName}" - it's used by ${inUseCount} item(s)`)
      return
    }
    try {
      const response = await fetch(`${API_URL}/subcategories/${subcategoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setAvailableSubcategories(availableSubcategories.filter(s => s.id !== subcategoryId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete subcategory')
      }
    } catch (err) {
      console.error('Failed to delete subcategory:', err)
    }
  }

  // AI Assistant functions
  const handleAiPhotoSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAiPhoto(file)
      setAiPhotoPreview(URL.createObjectURL(file))
    }
  }

  const removeAiPhoto = () => {
    if (aiPhotoPreview) URL.revokeObjectURL(aiPhotoPreview)
    setAiPhoto(null)
    setAiPhotoPreview(null)
  }

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setAiError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e) => {
      setIsListening(false)
      if (e.error !== 'no-speech') {
        setAiError(`Speech error: ${e.error}`)
      }
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        }
      }
      if (finalTranscript) {
        setAiDescription(prev => prev + (prev ? ' ' : '') + finalTranscript)
      }
    }

    recognition.start()
    window.currentRecognition = recognition
  }

  const stopVoiceInput = () => {
    if (window.currentRecognition) {
      window.currentRecognition.stop()
      window.currentRecognition = null
    }
    setIsListening(false)
  }

  const handleExtract = async () => {
    if (!aiDescription && !aiPhoto) {
      setAiError('Please provide a description or photo')
      return
    }

    setIsExtracting(true)
    setAiError(null)

    try {
      const body = { description: aiDescription }

      if (aiPhoto) {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1]
            resolve(base64Data)
          }
          reader.readAsDataURL(aiPhoto)
        })
        body.image = base64
        body.imageMediaType = aiPhoto.type || 'image/jpeg'
      }

      const response = await fetch(`${API_URL}/extract-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        setAiError(data.error || 'Extraction failed')
        setIsExtracting(false)
        return
      }

      // Track which fields were filled by AI
      const filled = {
        itemName: !!data.itemName,
        description: !!data.description,
        category: !!data.category,
        subcategory: !!data.subcategory,
        origin: !!data.origin,
        secondhand: !!data.secondhand,
        gifted: data.gifted === 'yes' || data.gifted === 'no',
        materials: !!(data.materials && Array.isArray(data.materials) && data.materials.length > 0)
      }
      setAiExtractedFields(filled)

      // Populate form fields from extraction - only fill empty fields
      if (data.itemName && !itemName) setItemName(data.itemName)
      if (data.description && !description) setDescription(data.description)
      if (data.category && !category) setCategory(data.category)
      if (data.subcategory && !subcategory) setSubcategory(data.subcategory)
      if (data.origin && !origin) setOrigin(data.origin)
      if (data.secondhand && !secondhand) setSecondhand(data.secondhand)
      if (data.gifted === 'yes' && !gifted) setGifted(true)
      if (data.materials && Array.isArray(data.materials) && data.materials.length > 0 && materials.length === 0) {
        setMaterials(data.materials)
      }

      // Transfer AI photo to main photos section
      if (aiPhoto && photoFiles.length < 5) {
        setPhotoFiles(prev => [...prev, aiPhoto].slice(0, 5))
        setPhotoPreviews(prev => [...prev, aiPhotoPreview].slice(0, 5))
      }

      // Clear AI section and collapse
      setAiDescription('')
      setAiPhoto(null)
      setAiPhotoPreview(null)
      setIsAiExpanded(false)

    } catch (err) {
      setAiError(`Error: ${err.message}`)
    }

    setIsExtracting(false)
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
    formData.append('privatePhotos', privatePhotos ? 'true' : 'false')
    formData.append('privateDescription', privateDescription ? 'true' : 'false')
    formData.append('privateOrigin', privateOrigin ? 'true' : 'false')
    formData.append('mainPhotoIndex', mainPhotoIndex)
    if (materials.length > 0) {
      formData.append('materials', JSON.stringify(materials))
    }

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

      // Call the callback with the new item
      onItemCreated(newItem)

      // Reset form
      setItemName('')
      setDescription('')
      setCategory('other')
      setSubcategory('')
      setOrigin('')
      setSecondhand('')
      setGifted(false)
      setPrivateItem(false)
      setPrivatePhotos(false)
      setPrivateDescription(false)
      setPrivateOrigin(false)
      setMaterials([])
      setPhotoFiles([])
      setPhotoPreviews([])
      setMainPhotoIndex(0)
      setAiExtractedFields(null)
    } else {
      console.error("Failed to add item.", await response.text())
    }

    setIsUploading(false)
  }

  return (
    <form className="w-full md:w-3/4 mx-auto mb-10 p-4 md:p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">

      {/* AI Assistant Section */}
      <div className="mb-6 border border-neutral-300 dark:border-neutral-600 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAiExpanded(!isAiExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
        >
          <span className="font-medium text-sm">AI Assistant</span>
          <span className="text-lg">{isAiExpanded ? '−' : '+'}</span>
        </button>

        {isAiExpanded && (
          <div className="p-4 space-y-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Describe your item using voice or text, optionally add a photo, and let AI fill in the form.
            </p>

            {/* Description textarea with voice input */}
            <div>
              <label className="block text-sm font-medium mb-1">Description:</label>
              <div className="relative">
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="Describe the item... (e.g., 'Blue cotton t-shirt from Target, bought new last week, size medium')"
                  className="w-full px-3 py-2 pr-12 text-base border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                />
                <button
                  type="button"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  className={`absolute bottom-2 right-2 p-2 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                  }`}
                  title={isListening ? 'Stop recording' : 'Start voice input'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </button>
              </div>
              {isListening && (
                <p className="mt-1 text-xs text-red-500">Recording... click mic to stop</p>
              )}
            </div>

            {/* Photo upload toggle */}
            <div>
              {!aiPhotoPreview ? (
                <label className="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400 hover:underline cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAiPhotoSelect}
                    className="hidden"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  Add photo for AI context (optional, costs more)
                </label>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={aiPhotoPreview}
                      alt="AI context"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeAiPhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Photo will be used for AI analysis and added to item photos after extraction.
                  </p>
                </div>
              )}
            </div>

            {/* Error display */}
            {aiError && (
              <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded">
                {aiError}
              </p>
            )}

            {/* Extract button */}
            <button
              type="button"
              onClick={handleExtract}
              disabled={isExtracting || (!aiDescription && !aiPhoto)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? 'Extracting...' : 'Extract & Fill Form'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Item Name: {shouldHighlight('itemName') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
        <input
          type="text"
          ref={itemNameRef}
          value={itemName}
          onChange={(e) => {
            setItemName(e.target.value)
            setErrors({...errors, itemName: false})
          }}
          className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.itemName ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'} ${shouldHighlight('itemName') && !itemName ? aiUnfilledClass : ''}`}
          onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
        />
        {errors.itemName && <span className="text-red-500 text-xs">Required</span>}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Description: {shouldHighlight('description') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
          <button
            type="button"
            onClick={() => !privateItem && setPrivateDescription(!privateDescription)}
            disabled={privateItem}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
              privateItem
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-400 dark:text-purple-500 cursor-not-allowed opacity-60'
                : privateDescription
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-600'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
            title={privateItem ? 'Entire item is private' : privateDescription ? 'Description is private' : 'Make description private'}
          >
            {privateItem || privateDescription ? '🔒 Private' : '🔓 Public'}
          </button>
        </div>
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setErrors({...errors, description: false})
          }}
          className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px] ${errors.description ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'} ${shouldHighlight('description') && !description ? aiUnfilledClass : ''}`}
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
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Origin: {shouldHighlight('origin') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
          <button
            type="button"
            onClick={() => !privateItem && setPrivateOrigin(!privateOrigin)}
            disabled={privateItem}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
              privateItem
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-400 dark:text-purple-500 cursor-not-allowed opacity-60'
                : privateOrigin
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-600'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
            title={privateItem ? 'Entire item is private' : privateOrigin ? 'Origin is private' : 'Make origin private'}
          >
            {privateItem || privateOrigin ? '🔒 Private' : '🔓 Public'}
          </button>
        </div>
        <input
          type="text"
          ref={originRef}
          value={origin}
          onChange={(e) => {
            setOrigin(e.target.value)
            setErrors({...errors, origin: false})
          }}
          className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.origin ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'} ${shouldHighlight('origin') && !origin ? aiUnfilledClass : ''}`}
          onKeyDown={(e) => handleKeyDown(e, categoryRef)}
        />
        {errors.origin && <span className="text-red-500 text-xs">Required</span>}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Category: {shouldHighlight('category') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
        <select
          ref={categoryRef}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setErrors({...errors, category: false})
          }}
          className={`w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.category ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'} ${shouldHighlight('category') && !category ? aiUnfilledClass : ''}`}
        >
          <option value="">-- Select --</option>
          {availableCategories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.displayName}</option>
          ))}
        </select>
        {errors.category && <span className="text-red-500 text-xs">Required</span>}

        {/* Manage categories toggle */}
        <button
          type="button"
          onClick={() => setShowManageCategories(!showManageCategories)}
          className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
        >
          {showManageCategories ? '− Hide manage categories' : '+ Manage categories'}
        </button>

        {/* Manage categories section */}
        {showManageCategories && (
          <div className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Add or remove categories:</p>

            {/* Existing categories as chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {availableCategories.map(cat => {
                const inUseCount = list.filter(item => item.category === cat.name).length
                return (
                  <div key={cat.id} className="relative group">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-lg border ${
                      category === cat.name
                        ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                        : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600'
                    }`}>
                      {cat.displayName}
                      <span className="text-xs text-neutral-400">({inUseCount})</span>
                    </span>
                    {/* Delete button - only show for unused categories */}
                    {inUseCount === 0 && isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCategoryFromDb(cat.id, cat.name)
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Delete category"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add new category input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Add new category..."
                className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addNewCategory()
                  }
                }}
              />
              <button
                type="button"
                onClick={addNewCategory}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {category === 'clothing' && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Subcategory: {shouldHighlight('subcategory') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className={`w-full px-3 py-2 text-base border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${shouldHighlight('subcategory') && !subcategory ? aiUnfilledClass : ''}`}
          >
            <option value="">-- Select --</option>
            {availableSubcategories
              .filter(sub => sub.category === 'clothing')
              .map(sub => (
                <option key={sub.id} value={sub.name}>{sub.displayName}</option>
              ))}
          </select>

          {/* Manage subcategories toggle */}
          <button
            type="button"
            onClick={() => setShowManageSubcategories(!showManageSubcategories)}
            className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            {showManageSubcategories ? '− Hide manage subcategories' : '+ Manage subcategories'}
          </button>

          {/* Manage subcategories section */}
          {showManageSubcategories && (
            <div className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Add or remove clothing subcategories:</p>

              {/* Existing subcategories as chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {availableSubcategories
                  .filter(sub => sub.category === 'clothing')
                  .map(sub => {
                    const inUseCount = list.filter(item => item.subcategory === sub.name).length
                    return (
                      <div key={sub.id} className="relative group">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-lg border ${
                          subcategory === sub.name
                            ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                            : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600'
                        }`}>
                          {sub.displayName}
                          <span className="text-xs text-neutral-400">({inUseCount})</span>
                        </span>
                        {/* Delete button - only show for unused subcategories */}
                        {inUseCount === 0 && isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteSubcategoryFromDb(sub.id, sub.name)
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="Delete subcategory"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Add new subcategory input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Add new subcategory..."
                  className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addNewSubcategory()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addNewSubcategory}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">New or Secondhand: {shouldHighlight('secondhand') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>
        <select
          value={secondhand}
          onChange={(e) => setSecondhand(e.target.value)}
          className={`w-full px-3 py-2 text-base border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${shouldHighlight('secondhand') && !secondhand ? aiUnfilledClass : ''}`}
        >
          <option value="">-- Select --</option>
          <option value="new">New</option>
          <option value="secondhand">Secondhand</option>
          <option value="handmade">Handmade</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      {/* Materials section - only for clothing and bedding */}
      {(category === 'clothing' || category === 'bedding') && (
        <div className={`mb-4 ${shouldHighlight('materials') && materials.length === 0 ? 'p-3 rounded-lg ' + aiUnfilledClass : ''}`}>
          <label className="block text-sm font-medium mb-2">Materials: {shouldHighlight('materials') && <span className="text-amber-600 text-xs ml-1">(not filled by AI)</span>}</label>

          {/* Available materials as buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {availableMaterials.map(mat => {
              const isSelected = materials.find(m => m.material === mat.name)
              const inUseCount = list.filter(item =>
                item.materials && item.materials.some(m => m.material === mat.name)
              ).length
              return (
                <div key={mat.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => isSelected ? removeMaterial(mat.name) : addMaterial(mat.name)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 hover:border-green-500'
                    }`}
                  >
                    {mat.name}
                  </button>
                  {/* Delete button - only show for unused materials */}
                  {inUseCount === 0 && !isSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMaterialFromDb(mat.id, mat.name)
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete material"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add new material input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
              placeholder="Add new material..."
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addNewMaterial()
                }
              }}
            />
            <button
              type="button"
              onClick={addNewMaterial}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add
            </button>
          </div>

          {/* Selected materials with percentage inputs */}
          {materials.length > 0 && (
            <div className="w-fit space-y-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-neutral-500 mb-2">Click percentage to edit (optional):</p>
              {materials.map(mat => (
                <div key={mat.material} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={mat.percentage || ''}
                    onChange={(e) => updateMaterialPercentage(mat.material, e.target.value)}
                    placeholder="%"
                    className="w-16 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-center"
                  />
                  <span className="text-sm">{mat.material}</span>
                  <button
                    type="button"
                    onClick={() => removeMaterial(mat.material)}
                    className="ml-auto text-red-500 hover:text-red-700 text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <span className="block text-sm font-medium mb-1">Gifted?</span>
        <label className="!inline-flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={gifted}
              onChange={(e) => setGifted(e.target.checked)}
              className="peer sr-only"
            />
            <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${
              gifted
                ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 hover:border-green-400 dark:hover:border-green-500'
            }`}>
              {gifted && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className={`text-sm leading-6 ${gifted ? 'text-green-700 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
            {gifted ? 'Yes, this is a gift' : 'Not a gift'}
          </span>
        </label>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Photos (up to 5):</label>
          <button
            type="button"
            onClick={() => !privateItem && setPrivatePhotos(!privatePhotos)}
            disabled={privateItem}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
              privateItem
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-400 dark:text-purple-500 cursor-not-allowed opacity-60'
                : privatePhotos
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-600'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
            title={privateItem ? 'Entire item is private' : privatePhotos ? 'Photos are private' : 'Make photos private'}
          >
            {privateItem || privatePhotos ? '🔒 Private' : '🔓 Public'}
          </button>
        </div>

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

      {/* Privacy Controls - Private Item toggle */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setPrivateItem(!privateItem)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
            privateItem
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
              : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-600'
          }`}
        >
          <span className="font-medium">Private Item?</span>
          <span className={`text-xs px-2 py-1 rounded ${privateItem ? 'bg-purple-200 dark:bg-purple-800' : 'bg-neutral-200 dark:bg-neutral-600'}`}>
            {privateItem ? 'Hidden from public' : 'Visible'}
          </span>
        </button>
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
  )
}

export default ItemForm
