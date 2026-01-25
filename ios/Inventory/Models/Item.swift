import Foundation

struct ItemPhoto: Codable, Identifiable, Equatable {
    let id: String
    let url: String
    let position: Int
    let createdAt: String?
}

struct ItemMaterial: Codable, Equatable {
    let material: String
    let percentage: Int
}

struct Item: Codable, Identifiable, Equatable {
    let id: String
    var itemName: String?
    var description: String?
    var category: String?
    var origin: String?
    var mainPhoto: String?
    let createdAt: String?
    var subcategory: String?
    var secondhand: String?
    var lastEdited: String?
    var gifted: String?
    var `private`: String?
    var materials: [ItemMaterial]?
    var privatePhotos: String?
    var privateDescription: String?
    var privateOrigin: String?
    var pinnedX: Double?
    var pinnedY: Double?
    var localCol: Int?
    var localRow: Int?
    var photos: [ItemPhoto]?

    var isPrivate: Bool {
        `private` == "true"
    }

    var isGifted: Bool {
        gifted == "true"
    }

    var isSecondhand: Bool {
        secondhand == "secondhand"
    }

    var isHandmade: Bool {
        secondhand == "handmade"
    }

    var sourceType: SourceType {
        switch secondhand {
        case "secondhand": return .secondhand
        case "handmade": return .handmade
        case "new": return .new
        default: return .unknown
        }
    }

    var displayName: String {
        guard let name = itemName, !name.isEmpty else { return "Untitled" }
        return name
    }

    var allPhotos: [String] {
        var urls: [String] = []
        if let main = mainPhoto, !main.isEmpty {
            urls.append(main)
        }
        if let additionalPhotos = photos {
            for photo in additionalPhotos where !urls.contains(photo.url) {
                urls.append(photo.url)
            }
        }
        return urls
    }
}

enum SourceType: String, CaseIterable {
    case new = "new"
    case secondhand = "secondhand"
    case handmade = "handmade"
    case unknown = "unknown"

    var displayName: String {
        switch self {
        case .new: return "New"
        case .secondhand: return "Secondhand"
        case .handmade: return "Handmade"
        case .unknown: return "Unknown"
        }
    }
}

struct CreateItemRequest {
    var itemName: String = ""
    var description: String = ""
    var category: String = ""
    var subcategory: String = ""
    var origin: String = ""
    var secondhand: String = "unknown"
    var gifted: String = "false"
    var isPrivate: Bool = false
    var privatePhotos: Bool = false
    var privateDescription: Bool = false
    var privateOrigin: Bool = false
    var materials: [ItemMaterial] = []
    var photos: [Data] = []
    var mainPhotoIndex: Int = 0
}
