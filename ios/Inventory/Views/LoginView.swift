import SwiftUI

struct LoginView: View {
    @ObservedObject var authService: AuthService
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Logo/Title
                VStack(spacing: 8) {
                    Image(systemName: "cube.box.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.blue)

                    Text("Inventory")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                }

                // Form
                VStack(spacing: 16) {
                    TextField("Username", text: $username)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    HStack {
                        if showPassword {
                            TextField("Password", text: $password)
                                .textFieldStyle(.roundedBorder)
                        } else {
                            SecureField("Password", text: $password)
                                .textFieldStyle(.roundedBorder)
                        }

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let error = authService.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        Task {
                            await authService.login(username: username, password: password)
                        }
                    } label: {
                        if authService.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Sign In")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .disabled(username.isEmpty || password.isEmpty || authService.isLoading)
                    .opacity(username.isEmpty || password.isEmpty ? 0.6 : 1)
                }
                .padding(.horizontal, 32)

                Spacer()
                Spacer()
            }
            .background(Color(.systemGroupedBackground))
        }
    }
}

#Preview {
    LoginView(authService: AuthService.shared)
}
