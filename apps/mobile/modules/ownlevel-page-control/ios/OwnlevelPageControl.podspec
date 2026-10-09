Pod::Spec.new do |s|
  s.name = 'OwnlevelPageControl'
  s.version = '1.0.0'
  s.summary = 'OWNLEVEL UIKit page control'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'OWNLEVEL'
  s.homepage = 'https://github.com/IS03/gym'
  s.source = { :git => 'https://github.com/IS03/gym.git' }
  s.platforms = { :ios => '16.4' }
  s.static_framework = true
  s.source_files = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
