import ExpoModulesCore
import LinkPresentation
import UIKit

public final class NovoriShareModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovoriShare")

    AsyncFunction("shareAsync") { (message: String, rawURL: String, promise: Promise) in
      guard let url = URL(string: rawURL), url.scheme != nil,
            let presenter = Self.presenter(),
            let logo = Self.logo() else {
        promise.resolve(false)
        return
      }

      let source = NovoriLinkItem(url: url, logo: logo)
      let sheet = UIActivityViewController(activityItems: [source, message], applicationActivities: nil)
      if let popover = sheet.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        popover.permittedArrowDirections = []
      }
      sheet.completionWithItemsHandler = { _, _, _, error in
        if let error {
          promise.reject("ERR_NOVORI_SHARE", error.localizedDescription)
        } else {
          // Cancel also counts as handled; don't reopen the fallback sheet.
          promise.resolve(true)
        }
      }
      presenter.present(sheet, animated: true)
    }.runOnQueue(.main)
  }

  private static func presenter() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      .filter { $0.activationState == .foregroundActive }
      .flatMap { $0.windows }
      .first(where: { $0.isKeyWindow })
    guard var controller = window?.rootViewController else { return nil }
    while let presented = controller.presentedViewController, !presented.isBeingDismissed {
      controller = presented
    }
    guard controller.viewIfLoaded?.window != nil,
          !controller.isBeingDismissed,
          !(controller is UIActivityViewController) else { return nil }
    return controller
  }

  private static func logo() -> UIImage? {
    for parent in [Bundle(for: NovoriShareModule.self), Bundle.main] {
      if let url = parent.url(forResource: "NovoriShareAssets", withExtension: "bundle"),
         let bundle = Bundle(url: url),
         let file = bundle.url(forResource: "novori-share-logo", withExtension: "png"),
         let image = UIImage(contentsOfFile: file.path) {
        return image
      }
    }
    return nil
  }
}

private final class NovoriLinkItem: NSObject, UIActivityItemSource {
  private let url: URL
  private let preview: LPLinkMetadata

  init(url: URL, logo: UIImage) {
    self.url = url
    let metadata = LPLinkMetadata()
    metadata.originalURL = url
    metadata.url = url
    metadata.title = "Shared with you on Novori"
    metadata.iconProvider = NSItemProvider(object: logo)
    self.preview = metadata
    super.init()
  }

  func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
    url
  }

  func activityViewController(_ activityViewController: UIActivityViewController, itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
    url
  }

  func activityViewControllerLinkMetadata(_ activityViewController: UIActivityViewController) -> LPLinkMetadata? {
    preview
  }
}
