import { useState, useEffect } from 'react'

const API_URL = 'https://bradie-inventory-api.onrender.com'

export function useInventoryData() {
  const [availableMaterials, setAvailableMaterials] = useState([])
  const [availableCategories, setAvailableCategories] = useState([])
  const [availableSubcategories, setAvailableSubcategories] = useState([])

  // Fetch available materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await fetch(`${API_URL}/materials`)
        if (response.ok) {
          const data = await response.json()
          setAvailableMaterials(data)
        }
      } catch (err) {
        console.error('Failed to fetch materials:', err)
      }
    }
    fetchMaterials()
  }, [])

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories`)
        if (response.ok) {
          const data = await response.json()
          setAvailableCategories(data)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch available subcategories
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        const response = await fetch(`${API_URL}/subcategories`)
        if (response.ok) {
          const data = await response.json()
          setAvailableSubcategories(data)
        }
      } catch (err) {
        console.error('Failed to fetch subcategories:', err)
      }
    }
    fetchSubcategories()
  }, [])

  return {
    availableMaterials,
    setAvailableMaterials,
    availableCategories,
    setAvailableCategories,
    availableSubcategories,
    setAvailableSubcategories
  }
}

export function useItemFilters(visibleList, filters) {
  const {
    searchQuery,
    selectedCategories,
    selectedSubcategories,
    selectedSources,
    selectedGifted,
    selectedMaterials,
    sortOrder,
    randomSeed
  } = filters

  // Helper to filter items, optionally excluding a specific filter type
  const getFilteredItems = (excludeFilter = null) => {
    return visibleList.filter(item => {
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
      if (excludeFilter !== 'category' && selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false

      // Subcategory filter (for clothing)
      if (excludeFilter !== 'subcategory' && item.category === 'clothing' && selectedSubcategories.length > 0) {
        const isUncategorized = !item.subcategory || item.subcategory === ''
        if (selectedSubcategories.includes('uncategorized') && isUncategorized) {
          // passes
        } else if (!selectedSubcategories.includes(item.subcategory)) {
          return false
        }
      }

      // Source filter
      if (excludeFilter !== 'source' && selectedSources.length > 0 && !selectedSources.includes(item.secondhand)) return false

      // Gifted filter
      if (excludeFilter !== 'gifted' && selectedGifted !== null) {
        const isGifted = item.gifted === 'true' || item.gifted === true
        if (selectedGifted && !isGifted) return false
        if (!selectedGifted && isGifted) return false
      }

      // Materials filter
      if (excludeFilter !== 'materials' && selectedMaterials.length > 0) {
        if (!item.materials || item.materials.length === 0) return false
        const itemMaterialNames = item.materials.map(m => m.material)
        const hasAnySelectedMaterial = selectedMaterials.some(mat => itemMaterialNames.includes(mat))
        if (!hasAnySelectedMaterial) return false
      }

      return true
    })
  }

  const filteredAndSortedList = visibleList
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

      // Materials filter (OR logic)
      if (selectedMaterials.length > 0) {
        if (!item.materials || item.materials.length === 0) return false
        const itemMaterialNames = item.materials.map(m => m.material)
        const hasAnySelectedMaterial = selectedMaterials.some(mat => itemMaterialNames.includes(mat))
        if (!hasAnySelectedMaterial) return false
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
      return 0
    })

  return {
    filteredAndSortedList,
    getFilteredItems
  }
}
