import Foundation

enum UserRole: String, Codable {
    case admin
    case friend
    case none
}

struct LoginResponse: Codable {
    let token: String
    let role: String
}

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var userRole: UserRole = .none
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let tokenKey = "auth_token"
    private let roleKey = "user_role"

    private init() {
        loadStoredAuth()
    }

    var token: String? {
        KeychainHelper.shared.readString(forKey: tokenKey)
    }

    private func loadStoredAuth() {
        if let storedToken = KeychainHelper.shared.readString(forKey: tokenKey),
           !storedToken.isEmpty {
            isAuthenticated = true
            if let roleString = KeychainHelper.shared.readString(forKey: roleKey),
               let role = UserRole(rawValue: roleString) {
                userRole = role
            }
        }
    }

    func login(username: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.login(username: username, password: password)
            KeychainHelper.shared.save(response.token, forKey: tokenKey)
            KeychainHelper.shared.save(response.role, forKey: roleKey)
            isAuthenticated = true
            userRole = UserRole(rawValue: response.role) ?? .none
            isLoading = false
            return true
        } catch let error as APIError {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        } catch {
            errorMessage = "An unexpected error occurred"
            isLoading = false
            return false
        }
    }

    func logout() {
        KeychainHelper.shared.delete(forKey: tokenKey)
        KeychainHelper.shared.delete(forKey: roleKey)
        isAuthenticated = false
        userRole = .none
    }

    var isAdmin: Bool {
        userRole == .admin
    }
}
