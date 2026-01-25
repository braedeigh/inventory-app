import Foundation

struct CommunityItem: Codable, Identifiable, Equatable {
    let id: String
    var itemName: String
    var description: String?
    var category: String?
    var origin: String?
    var mainPhoto: String?
    let createdAt: String?
    var subcategory: String?
    var submittedBy: String?
    var approved: Int?

    var isApproved: Bool {
        approved == 1
    }

    var displayName: String {
        itemName.isEmpty ? "Untitled" : itemName
    }
}

struct CommunitySubmission {
    var itemName: String = ""
    var description: String = ""
    var category: String = ""
    var subcategory: String = ""
    var origin: String = ""
    var submittedBy: String = ""
    var photo: Data?
}
