import Foundation
import SwiftUI

enum SortOption: String, CaseIterable {
    case newest = "newest"
    case oldest = "oldest"
    case alphabetical = "alphabetical"
    case random = "random"

    var displayName: String {
        switch self {
        case .newest: return "Newest"
        case .oldest: return "Oldest"
        case .alphabetical: return "A-Z"
        case .random: return "Random"
        }
    }
}

struct FilterState {
    var searchText: String = ""
    var selectedCategory: String?
    var selectedSubcategory: String?
    var selectedSource: SourceType?
    var selectedMaterials: Set<String> = []
    var showGiftedOnly: Bool = false
    var sortOption: SortOption = .newest

    var hasActiveFilters: Bool {
        !searchText.isEmpty ||
        selectedCategory != nil ||
        selectedSubcategory != nil ||
        selectedSource != nil ||
        !selectedMaterials.isEmpty ||
        showGiftedOnly
    }

    mutating func reset() {
        searchText = ""
        selectedCategory = nil
        selectedSubcategory = nil
        selectedSource = nil
        selectedMaterials = []
        showGiftedOnly = false
    }
}

@MainActor
final class InventoryViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var categories: [Category] = []
    @Published var materials: [Material] = []
    @Published var subcategories: [Subcategory] = []

    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published var filterState = FilterState()

    @Published var selectedItem: Item?
    @Published var isShowingItemForm = false
    @Published var editingItem: Item?

    var filteredItems: [Item] {
        var result = items

        // Search filter
        if !filterState.searchText.isEmpty {
            let searchLower = filterState.searchText.lowercased()
            result = result.filter { item in
                (item.itemName?.lowercased().contains(searchLower) ?? false) ||
                (item.description?.lowercased().contains(searchLower) ?? false) ||
                (item.origin?.lowercased().contains(searchLower) ?? false) ||
                (item.category?.lowercased().contains(searchLower) ?? false)
            }
        }

        // Category filter
        if let category = filterState.selectedCategory {
            result = result.filter { $0.category == category }
        }

        // Subcategory filter
        if let subcategory = filterState.selectedSubcategory {
            result = result.filter { $0.subcategory == subcategory }
        }

        // Source filter
        if let source = filterState.selectedSource {
            result = result.filter { $0.sourceType == source }
        }

        // Materials filter
        if !filterState.selectedMaterials.isEmpty {
            result = result.filter { item in
                guard let itemMaterials = item.materials else { return false }
                let itemMaterialNames = Set(itemMaterials.map { $0.material })
                return !filterState.selectedMaterials.isDisjoint(with: itemMaterialNames)
            }
        }

        // Gifted filter
        if filterState.showGiftedOnly {
            result = result.filter { $0.isGifted }
        }

        // Sorting
        switch filterState.sortOption {
        case .newest:
            result.sort { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
        case .oldest:
            result.sort { ($0.createdAt ?? "") < ($1.createdAt ?? "") }
        case .alphabetical:
            result.sort { ($0.itemName ?? "").lowercased() < ($1.itemName ?? "").lowercased() }
        case .random:
            result.shuffle()
        }

        return result
    }

    var categoryFilterCounts: [String: Int] {
        var counts: [String: Int] = [:]
        for item in items {
            if let category = item.category {
                counts[category, default: 0] += 1
            }
        }
        return counts
    }

    var subcategoriesForSelectedCategory: [Subcategory] {
        guard let category = filterState.selectedCategory else { return [] }
        return subcategories.filter { $0.category == category }
    }

    // MARK: - Data Loading

    func loadAllData() async {
        isLoading = true
        errorMessage = nil

        do {
            async let itemsTask = APIClient.shared.fetchItems()
            async let categoriesTask = APIClient.shared.fetchCategories()
            async let materialsTask = APIClient.shared.fetchMaterials()
            async let subcategoriesTask = APIClient.shared.fetchSubcategories()

            let (fetchedItems, fetchedCategories, fetchedMaterials, fetchedSubcategories) = try await (
                itemsTask,
                categoriesTask,
                materialsTask,
                subcategoriesTask
            )

            items = fetchedItems
            categories = fetchedCategories
            materials = fetchedMaterials
            subcategories = fetchedSubcategories
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func refreshItems() async {
        do {
            items = try await APIClient.shared.fetchItems()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Item Operations

    func createItem(_ request: CreateItemRequest) async -> Bool {
        isLoading = true
        errorMessage = nil

        do {
            let newItem = try await APIClient.shared.createItem(request)
            items.insert(newItem, at: 0)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    func updateItem(id: String, request: CreateItemRequest) async -> Bool {
        isLoading = true
        errorMessage = nil

        do {
            let updatedItem = try await APIClient.shared.updateItem(id: id, request: request)
            if let index = items.firstIndex(where: { $0.id == id }) {
                items[index] = updatedItem
            }
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    func deleteItem(_ item: Item) async -> Bool {
        do {
            try await APIClient.shared.deleteItem(id: item.id)
            items.removeAll { $0.id == item.id }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Photo Operations

    func uploadPhotos(to item: Item, photos: [Data]) async -> Bool {
        do {
            let newPhotos = try await APIClient.shared.uploadPhotos(itemId: item.id, photos: photos)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                var updatedItem = items[index]
                var existingPhotos = updatedItem.photos ?? []
                existingPhotos.append(contentsOf: newPhotos)
                updatedItem.photos = existingPhotos
                items[index] = updatedItem
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func deletePhoto(from item: Item, photoId: String) async -> Bool {
        do {
            try await APIClient.shared.deletePhoto(itemId: item.id, photoId: photoId)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                var updatedItem = items[index]
                updatedItem.photos?.removeAll { $0.id == photoId }
                items[index] = updatedItem
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func setMainPhoto(for item: Item, photoUrl: String) async -> Bool {
        do {
            let updatedItem = try await APIClient.shared.setMainPhoto(itemId: item.id, photoUrl: photoUrl)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index] = updatedItem
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Category & Material Management

    func addCategory(name: String) async -> Bool {
        do {
            let newCategory = try await APIClient.shared.addCategory(name: name)
            categories.append(newCategory)
            categories.sort { $0.displayName < $1.displayName }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func addMaterial(name: String) async -> Bool {
        do {
            let newMaterial = try await APIClient.shared.addMaterial(name: name)
            materials.append(newMaterial)
            materials.sort { $0.name < $1.name }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func addSubcategory(name: String, category: String) async -> Bool {
        do {
            let newSubcategory = try await APIClient.shared.addSubcategory(name: name, category: category)
            subcategories.append(newSubcategory)
            subcategories.sort { $0.displayName < $1.displayName }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
