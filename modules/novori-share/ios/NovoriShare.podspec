Pod::Spec.new do |s|
  s.name = 'NovoriShare'
  s.version = '1.0.0'
  s.summary = 'Native Novori link share previews'
  s.description = 'Provides bundled link metadata to the iOS share sheet.'
  s.homepage = 'https://novori.link'
  s.license = { :type => 'Proprietary' }
  s.author = 'Novori'
  s.source = { :git => 'https://github.com/tmcmillin24/novori.git' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'NovoriShareAssets' => ['Assets/*.png'] }
  s.frameworks = 'UIKit', 'LinkPresentation'
end
