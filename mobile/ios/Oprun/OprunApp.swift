import SwiftUI
import WebKit

private let workspaceURL = URL(string: "https://www.oprun.ai/saas/workspace.html")!

@main
struct OprunApp: App {
    var body: some Scene { WindowGroup { WorkspaceView() } }
}

@MainActor
final class WorkspaceBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let webView: WKWebView
    @Published var failed = false
    @Published var loading = false
    @Published var browserRequired = false

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        if #available(iOS 16.4, *) { webView.isInspectable = false }
        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(reload), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        open(workspaceURL)
    }

    static func isOprun(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == "www.oprun.ai" && (url.port == nil || url.port == 443)
    }
    func open(_ url: URL) {
        guard Self.isOprun(url), url.user == nil, url.password == nil else { return }
        failed = false
        webView.load(URLRequest(url: url))
    }
    @objc func reload() {
        failed = false
        if webView.url == nil { open(workspaceURL) } else { webView.reload() }
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { loading = true }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        failed = false; loading = false; webView.scrollView.refreshControl?.endRefreshing()
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        failed = true; loading = false; webView.scrollView.refreshControl?.endRefreshing()
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed = true; loading = false; webView.scrollView.refreshControl?.endRefreshing()
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if Self.isOprun(url) {
            if navigationAction.targetFrame == nil { open(url); decisionHandler(.cancel) }
            else { decisionHandler(.allow) }
            return
        }
        if navigationAction.targetFrame?.isMainFrame == false && url.scheme == "https" {
            decisionHandler(.allow) // The website's CSP still restricts embedded content.
            return
        }
        // Third-party subframes cannot replace the app. User-initiated provider,
        // payment, email and phone links are handled by the system instead.
        if navigationAction.navigationType == .linkActivated && ["https", "mailto", "tel"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        } else if url.scheme == "https" {
            // An OAuth redirect is not a user-activated link. Avoid silently
            // trapping it in an embedded browser that the provider may reject.
            browserRequired = true
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.protocol == "https" && origin.host == "www.oprun.ai" ? .prompt : .deny)
    }
}

struct WorkspaceWebView: UIViewRepresentable {
    let browser: WorkspaceBrowser
    func makeUIView(context: Context) -> WKWebView { browser.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

@MainActor
struct WorkspaceView: View {
    @StateObject private var browser = WorkspaceBrowser()
    var body: some View {
        VStack(spacing: 0) {
            if browser.loading { ProgressView().progressViewStyle(.linear).tint(.yellow) }
            ZStack {
                WorkspaceWebView(browser: browser)
                if browser.failed {
                    VStack(spacing: 18) {
                        Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                        Text("Reconnect to your office").font(.title2).bold()
                        Text("Check your connection and try again. Your private records require a connection to Oprun.").multilineTextAlignment(.center)
                        Button("Try again") { browser.reload() }.buttonStyle(.borderedProminent)
                    }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(.systemBackground))
                }
            }
            HStack {
                Button { browser.webView.goBack() } label: { Label("Back", systemImage: "chevron.left") }
                Spacer()
                Button { browser.open(workspaceURL) } label: { Label("Workspace", systemImage: "square.grid.2x2") }
                Spacer()
                Menu {
                    Button { browser.reload() } label: { Label("Refresh", systemImage: "arrow.clockwise") }
                    Button { UIApplication.shared.open(workspaceURL) } label: { Label("Open workspace in Safari", systemImage: "safari") }
                    Button { browser.open(URL(string: "https://www.oprun.ai/help")!) } label: { Label("Help", systemImage: "questionmark.circle") }
                    ShareLink("Share Oprun", item: URL(string: "https://www.oprun.ai/")!)
                } label: { Label("More", systemImage: "ellipsis.circle") }
            }.font(.footnote).padding().background(.bar)
        }
        .onOpenURL { url in browser.open(url) }
        .alert("Continue in Safari", isPresented: $browser.browserRequired) {
            Button("Open workspace in Safari") { UIApplication.shared.open(workspaceURL) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This connection requires a browser. Sign in to Oprun in Safari, complete the connection there, then return and refresh the app.")
        }
        .preferredColorScheme(.dark)
    }
}
