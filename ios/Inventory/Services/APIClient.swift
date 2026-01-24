import Foundation
import UIKit

enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case unauthorized
    case forbidden
    case serverError(String)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Invalid credentials"
        case .forbidden:
            return "Access denied"
        case .serverError(let message):
            return message
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        }
    }
}

final class APIClient {
    static let shared = APIClient()
    private init() {}

    private let baseURL = "https://bradie-inventory-api.onrender.com"

    private var authToken: String? {
        KeychainHelper.shared.readString(forKey: "auth_token")
    }

    private func makeRequest(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        contentType: String = "application/json"
    ) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = body
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            switch httpResponse.statusCode {
            case 200...299:
                return data
            case 401:
                throw APIError.unauthorized
            case 403:
                throw APIError.forbidden
            default:
                if let errorDict = try? JSONDecoder().decode([String: String].self, from: data),
                   let message = errorDict["error"] {
                    throw APIError.serverError(message)
                }
                throw APIError.serverError("Server error: \(httpResponse.statusCode)")
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Authentication

    func login(username: String, password: String) async throws -> LoginResponse {
        let body = try JSONEncoder().encode(["username": username, "password": password])
        let data = try await makeRequest(endpoint: "/login", method: "POST", body: body)
        return try JSONDecoder().decode(LoginResponse.self, from: data)
    }

    // MARK: - Items

    func fetchItems() async throws -> [Item] {
        let data = try await makeRequest(endpoint: "/")
        return try JSONDecoder().decode([Item].self, from: data)
    }

    func fetchItem(id: String) async throws -> Item {
        let data = try await makeRequest(endpoint: "/item/\(id)")
        return try JSONDecoder().decode(Item.self, from: data)
    }

    func createItem(_ request: CreateItemRequest) async throws -> Item {
        let boundary = UUID().uuidString
        var body = Data()

        // Add text fields
        let fields: [(String, String)] = [
            ("itemName", request.itemName),
            ("description", request.description),
            ("category", request.category),
            ("subcategory", request.subcategory),
            ("origin", request.origin),
            ("secondhand", request.secondhand),
            ("gifted", request.gifted),
            ("private", request.isPrivate ? "true" : "false"),
            ("privatePhotos", request.privatePhotos ? "true" : "false"),
            ("privateDescription", request.privateDescription ? "true" : "false"),
            ("privateOrigin", request.privateOrigin ? "true" : "false"),
            ("mainPhotoIndex", String(request.mainPhotoIndex))
        ]

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        // Add materials as JSON
        if !request.materials.isEmpty {
            let materialsJSON = try JSONEncoder().encode(request.materials)
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"materials\"\r\n\r\n".data(using: .utf8)!)
            body.append(materialsJSON)
            body.append("\r\n".data(using: .utf8)!)
        }

        // Add photos
        for (index, photoData) in request.photos.enumerated() {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photos\"; filename=\"photo\(index).jpg\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(photoData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        guard let url = URL(string: "\(baseURL)/") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode(Item.self, from: data)
    }

    func updateItem(id: String, request: CreateItemRequest) async throws -> Item {
        let boundary = UUID().uuidString
        var body = Data()

        let fields: [(String, String)] = [
            ("itemName", request.itemName),
            ("description", request.description),
            ("category", request.category),
            ("subcategory", request.subcategory),
            ("origin", request.origin),
            ("secondhand", request.secondhand),
            ("gifted", request.gifted),
            ("private", request.isPrivate ? "true" : "false"),
            ("privatePhotos", request.privatePhotos ? "true" : "false"),
            ("privateDescription", request.privateDescription ? "true" : "false"),
            ("privateOrigin", request.privateOrigin ? "true" : "false"),
            ("mainPhotoIndex", String(request.mainPhotoIndex))
        ]

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        if !request.materials.isEmpty {
            let materialsJSON = try JSONEncoder().encode(request.materials)
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"materials\"\r\n\r\n".data(using: .utf8)!)
            body.append(materialsJSON)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        guard let url = URL(string: "\(baseURL)/item/\(id)") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode(Item.self, from: data)
    }

    func deleteItem(id: String) async throws {
        _ = try await makeRequest(endpoint: "/item/\(id)", method: "DELETE")
    }

    // MARK: - Photos

    func uploadPhotos(itemId: String, photos: [Data]) async throws -> [ItemPhoto] {
        let boundary = UUID().uuidString
        var body = Data()

        for (index, photoData) in photos.enumerated() {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photos\"; filename=\"photo\(index).jpg\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(photoData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        guard let url = URL(string: "\(baseURL)/item/\(itemId)/photos") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode([ItemPhoto].self, from: data)
    }

    func deletePhoto(itemId: String, photoId: String) async throws {
        _ = try await makeRequest(endpoint: "/item/\(itemId)/photos/\(photoId)", method: "DELETE")
    }

    func setMainPhoto(itemId: String, photoUrl: String) async throws -> Item {
        let body = try JSONEncoder().encode(["mainPhoto": photoUrl])
        let data = try await makeRequest(endpoint: "/item/\(itemId)/main-photo", method: "PUT", body: body)
        return try JSONDecoder().decode(Item.self, from: data)
    }

    // MARK: - Categories

    func fetchCategories() async throws -> [Category] {
        let data = try await makeRequest(endpoint: "/categories")
        return try JSONDecoder().decode([Category].self, from: data)
    }

    func addCategory(name: String) async throws -> Category {
        let body = try JSONEncoder().encode(["name": name])
        let data = try await makeRequest(endpoint: "/categories", method: "POST", body: body)
        return try JSONDecoder().decode(Category.self, from: data)
    }

    // MARK: - Materials

    func fetchMaterials() async throws -> [Material] {
        let data = try await makeRequest(endpoint: "/materials")
        return try JSONDecoder().decode([Material].self, from: data)
    }

    func addMaterial(name: String) async throws -> Material {
        let body = try JSONEncoder().encode(["name": name])
        let data = try await makeRequest(endpoint: "/materials", method: "POST", body: body)
        return try JSONDecoder().decode(Material.self, from: data)
    }

    // MARK: - Subcategories

    func fetchSubcategories(category: String? = nil) async throws -> [Subcategory] {
        var endpoint = "/subcategories"
        if let category = category {
            endpoint += "?category=\(category)"
        }
        let data = try await makeRequest(endpoint: endpoint)
        return try JSONDecoder().decode([Subcategory].self, from: data)
    }

    func addSubcategory(name: String, category: String) async throws -> Subcategory {
        let body = try JSONEncoder().encode(["name": name, "category": category])
        let data = try await makeRequest(endpoint: "/subcategories", method: "POST", body: body)
        return try JSONDecoder().decode(Subcategory.self, from: data)
    }

    // MARK: - Community

    func fetchCommunityItems() async throws -> [CommunityItem] {
        let data = try await makeRequest(endpoint: "/community")
        return try JSONDecoder().decode([CommunityItem].self, from: data)
    }

    func fetchPendingCommunityItems() async throws -> [CommunityItem] {
        let data = try await makeRequest(endpoint: "/community/pending")
        return try JSONDecoder().decode([CommunityItem].self, from: data)
    }

    func submitCommunityItem(_ submission: CommunitySubmission) async throws -> CommunityItem {
        let boundary = UUID().uuidString
        var body = Data()

        let fields: [(String, String)] = [
            ("itemName", submission.itemName),
            ("description", submission.description),
            ("category", submission.category),
            ("subcategory", submission.subcategory),
            ("origin", submission.origin),
            ("submittedBy", submission.submittedBy)
        ]

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        if let photoData = submission.photo {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(photoData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        guard let url = URL(string: "\(baseURL)/community") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode(CommunityItem.self, from: data)
    }

    func approveCommunityItem(id: String) async throws {
        _ = try await makeRequest(endpoint: "/community/\(id)/approve", method: "PUT")
    }

    func rejectCommunityItem(id: String) async throws {
        _ = try await makeRequest(endpoint: "/community/\(id)", method: "DELETE")
    }

    // MARK: - Random Item

    func fetchRandomItem() async throws -> Item {
        let data = try await makeRequest(endpoint: "/random")
        return try JSONDecoder().decode(Item.self, from: data)
    }
}
