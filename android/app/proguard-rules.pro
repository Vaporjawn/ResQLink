# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ================================
# ResQLink Specific Rules
# ================================

# Keep all ResQLink models and data classes
-keep class com.resqlink.mesh.** { *; }

# ================================
# Capacitor Core Rules
# ================================

# Keep Capacitor plugins and interfaces
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    @com.getcapacitor.annotation.CapacitorMethod <methods>;
}
-keep interface com.getcapacitor.** { *; }
-keep class com.getcapacitor.** { *; }

# Keep plugin methods annotated with @CapacitorMethod
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# ================================
# WebView and JavaScript Interface
# ================================

# Keep JavaScript interface for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView related classes
-keep class android.webkit.** { *; }
-keepattributes JavascriptInterface
-keepattributes *Annotation*

# ================================
# Capacitor Plugins
# ================================

# Keep all plugin classes
-keep class com.capacitorjs.plugins.** { *; }
-keep interface com.capacitorjs.plugins.** { *; }

# Filesystem Plugin
-keep class com.capacitorjs.plugins.filesystem.** { *; }

# Camera Plugin
-keep class com.capacitorjs.plugins.camera.** { *; }

# Geolocation Plugin
-keep class com.capacitorjs.plugins.geolocation.** { *; }

# Local Notifications Plugin
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# Haptics Plugin
-keep class com.capacitorjs.plugins.haptics.** { *; }

# ================================
# Debugging Support
# ================================

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep source file names for better crash reports
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions

# ================================
# Reflection Support
# ================================

# Keep classes that use reflection
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ================================
# Serialization Support
# ================================

# Keep serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ================================
# AndroidX and Support Library
# ================================

# Keep AndroidX classes
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ================================
# Cordova Rules (if using Cordova plugins)
# ================================

-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin
-keep class org.apache.cordova.CordovaBridge { *; }
-keep class org.apache.cordova.PluginResult { *; }
-keep class org.apache.cordova.CordovaResourceApi { *; }

# ================================
# General Android Rules
# ================================

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom view constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Keep R class members
-keepclassmembers class **.R$* {
    public static <fields>;
}

# ================================
# Optimization Rules
# ================================

# Allow optimization but prevent over-aggressive removal
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification
-dontpreverify

# ================================
# Warning Suppression
# ================================

# Suppress warnings for common libraries
-dontwarn com.google.android.material.**
-dontwarn com.google.firebase.**
-dontwarn org.apache.http.**
-dontwarn android.net.http.**

