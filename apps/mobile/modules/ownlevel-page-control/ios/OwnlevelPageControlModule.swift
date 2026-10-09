import ExpoModulesCore
import UIKit

public final class OwnlevelPageControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OwnlevelPageControl")
    Constant("isAvailable") { true }

    View(OwnlevelPageControlView.self) {
      Events("onPageChange")

      Prop("labels") { (view, labels: [String]) in
        view.setLabels(labels)
      }
      Prop("page") { (view, page: Int) in
        view.setPage(page)
      }
      Prop("activeColor") { (view, color: UIColor?) in
        view.pageControl.currentPageIndicatorTintColor = color
      }
      Prop("inactiveColor") { (view, color: UIColor?) in
        view.pageControl.pageIndicatorTintColor = color?.withAlphaComponent(0.35)
      }
      Prop("isDark") { (view, isDark: Bool) in
        view.overrideUserInterfaceStyle = isDark ? .dark : .light
      }
    }
  }
}

public final class OwnlevelPageControlView: ExpoView {
  let pageControl = UIPageControl()
  let onPageChange = EventDispatcher()
  private var labels: [String] = []
  private var requestedPage = 0

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // UIKit owns the dots, material, touch interaction and adjustable VoiceOver behavior.
    pageControl.backgroundStyle = .prominent
    pageControl.allowsContinuousInteraction = true
    pageControl.hidesForSinglePage = true
    pageControl.accessibilityLabel = "Resumen de esta semana"
    pageControl.addTarget(self, action: #selector(pageChanged), for: .valueChanged)
    clipsToBounds = false
    addSubview(pageControl)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    // The host has a 44 pt touch area; UIKit chooses its own internal visual geometry.
    pageControl.frame = bounds
  }

  func setLabels(_ value: [String]) {
    labels = value
    pageControl.numberOfPages = value.count
    pageControl.isEnabled = value.count > 1
    applyPage()
  }

  func setPage(_ value: Int) {
    requestedPage = value
    // Do not let delayed JS acknowledgements pull the native control back mid-scrub.
    if !pageControl.isTracking { applyPage() }
  }

  private func applyPage() {
    pageControl.currentPage = max(0, min(requestedPage, max(0, labels.count - 1)))
    updateAccessibilityValue()
  }

  private func updateAccessibilityValue() {
    guard !labels.isEmpty else {
      pageControl.accessibilityValue = nil
      return
    }
    let page = pageControl.currentPage
    pageControl.accessibilityValue = "Página \(page + 1) de \(labels.count): \(labels[page])"
  }

  @objc private func pageChanged() {
    requestedPage = pageControl.currentPage
    updateAccessibilityValue()
    onPageChange(["page": requestedPage])
  }
}
