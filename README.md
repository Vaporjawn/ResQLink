# ResQLink: Decentralized Emergency Communication

**A peer-to-peer mesh networking application for off-grid communication, built with Ionic, React, and Capacitor.**

---

## 🚀 Project Overview

ResQLink is a mobile application designed to provide a reliable and secure communication platform in emergency situations where traditional network infrastructure is unavailable. It leverages mesh networking technology to create a decentralized, peer-to-peer network of mobile devices, allowing users to send messages, share their location, and broadcast emergency alerts without relying on cellular or internet connectivity.

### Key Features

*   **Offline Messaging**: Send and receive text messages, photos, and voice notes in a completely off-grid environment.
*   **E2E Encryption**: All communications are end-to-end encrypted using TweetNaCl.js, ensuring that only the intended recipients can read the messages.
*   **Location Sharing**: Share your real-time location with your contacts or broadcast it in an emergency.
*   **Emergency SOS**: Broadcast emergency alerts to all nearby users, providing critical information to first responders and other users in the area.
*   **Resource Mapping**: View a map of nearby resources, such as shelters, medical facilities, and water sources, added by other users.

### Technology Stack

*   **Frontend**: Ionic React
*   **Mobile**: Capacitor
*   **Cryptography**: TweetNaCl.js
*   **Mapping**: MapLibre GL JS
*   **State Management**: Zustand

### Project Status

**Maturity**: Core features are complete, and the project is currently in the production readiness phase. The focus is on improving stability, documentation, and preparing for app store deployment.

---

## 📦 Installation

### Prerequisites

*   **Node.js**: v18.x or higher
*   **npm**: v8.x or higher
*   **Android Studio**: For Android development
*   **Xcode**: For iOS development

### Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/ResQLink.git
    cd ResQLink
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Setup:**

    No environment variables are required for the standard build.

4.  **Platform-Specific Setup:**

    *   **Android**

        *   Open the `android` directory in Android Studio.
        *   Sync the project with Gradle files.

    *   **iOS**

        *   Run the following command to sync the project:

            ```bash
            npx cap sync ios
            ```

        *   Open the project in Xcode:

            ```bash
            npx cap open ios
            ```

---

## 💻 Development Workflow

### Local Development

To start the development server, run:

```bash
npm run dev
```

This will open the app in your browser. Changes to the source code will be reflected in real-time.

### Testing

*   **Unit Tests**: Run unit tests with the following command:

    ```bash
    npm run test.unit
    ```

*   **End-to-End (E2E) Tests**: Run E2E tests with Cypress:

    ```bash
    npm run test.e2e
    ```

### Building for Production

To create a production build, run:

```bash
npm run build
```

This will generate a `dist` folder with the optimized and minified assets.

### Mobile Development

*   **Syncing with Native Projects**:

    After making changes to the web code, you need to sync it with the native projects:

    ```bash
    npx cap sync
    ```

*   **Opening Native IDEs**:

    *   Android Studio:

        ```bash
        npx cap open android
        ```

    *   Xcode:

        ```bash
        npx cap open ios
        ```

### Debugging

*   **Browser**: Use the browser's developer tools for debugging the web app.
*   **Android**: Use Android Studio's Logcat for native Android debugging.
*   **iOS**: Use Xcode's console for native iOS debugging.

---

## 🏛️ Architecture

### High-Level Overview

```
+----------------------------------------------------+
|                 ResQLink Mobile App                |
+----------------------------------------------------+
|                  UI (Ionic/React)                  |
|----------------------------------------------------|
|      State Management (Zustand) & Services         |
|----------------------------------------------------|
|      Capacitor (Native Bridge) & Mesh Manager      |
+----------------------------------------------------+
|      Native Layer (Android/iOS) & P2P Network      |
+----------------------------------------------------+
```

### Component Structure

The application is structured into the following main components:

*   **`src/components`**: Reusable React components used throughout the application, such as `ChatInterface`, `EmergencyContacts`, and `ResourceMap`.
*   **`src/pages`**: Top-level pages for each tab in the application, such as `MessagesPage`, `ResourcesPage`, and `Tab3` (Settings).
*   **`src/services`**: Core services that handle business logic, such as `LocationService` and `EmergencyBroadcastService`.
*   **`src/lib`**: Core libraries and utilities, including cryptography (`crypto.ts`), data schemas (`schema.ts`), state management (`store.ts`), and the mesh networking manager (`mesh.ts`).

### Mesh Networking

The mesh networking is managed by the `MeshManager` class, which is responsible for:

*   Discovering nearby peers.
*   Establishing and maintaining connections.
*   Broadcasting and relaying messages.

### Message Encryption

All messages are end-to-end encrypted using TweetNaCl.js. The encryption flow is as follows:

1.  A symmetric key is generated for each message.
2.  The message content is encrypted with the symmetric key.
3.  The symmetric key is then encrypted for each recipient using their public key (X25519).
4.  The encrypted message and the encrypted symmetric keys (key envelopes) are broadcast to the network.

### State Management

State management is handled by Zustand, a small, fast, and scalable state-management solution. The store (`src/lib/store.ts`) holds the application state, including messages, contacts, and the mesh network status.

### Service Layer

The service layer contains the core business logic of the application:

*   **`LocationService`**: Manages GPS location tracking and provides location updates to the rest of the application.
*   **`EmergencyBroadcastService`**: Handles the creation and broadcasting of emergency alerts.

---

## ✨ Features

### Messaging

The messaging system allows users to send and receive text messages, photos, and voice notes. All messages are end-to-end encrypted and transmitted over the mesh network.

### Camera Integration

Users can capture photos and videos directly within the app and share them with their contacts. The camera integration is built using the Capacitor Camera plugin.

### Location Sharing

Users can share their real-time location with their contacts. This feature is powered by the `LocationService`, which uses the device's GPS to obtain location data.

### Emergency Broadcast

The emergency broadcast system allows users to send SOS alerts to all nearby users. These alerts are given high priority and are designed to be seen by as many people as possible.

### Contact Management

Users can add, edit, and delete contacts. They can also create groups to send messages to multiple people at once.

### Settings

The settings page allows users to configure the application, including their display name, language, and location sharing preferences.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines when contributing to the project.

### Code Style

This project uses Prettier for code formatting. Please run `npm run lint` before submitting a pull request to ensure your code conforms to the project's style.

### Commit Messages

Please follow the Conventional Commits specification for your commit messages.

### Pull Requests

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with a descriptive commit message.
4.  Push your changes to your fork.
5.  Create a pull request to the `main` branch of the original repository.

### Testing

Please ensure that your changes do not break any existing tests. If you are adding a new feature, please include unit tests for that feature.

### Bug Reports

If you find a bug, please open an issue on the GitHub repository. Please include a clear and concise description of the bug, as well as steps to reproduce it.
