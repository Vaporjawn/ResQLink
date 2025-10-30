import { lazy, Suspense, useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonSpinner,
  IonContent,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { chatbubbleEllipses, people, map, settings } from 'ionicons/icons';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import {
  startBatteryMonitoring,
  stopBatteryMonitoring,
  logPerformanceSummary
} from './lib/performance';
import { useResQLinkStore } from './lib/store';

// Lazy load route components for better code splitting and performance
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * Using CSS class method for programmatic theme control.
 * Theme is imported in variables.css and managed by store.
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* Theme variables - includes dark palette import */
import './theme/variables.css';

// Configure Ionic with custom page transitions
setupIonicReact({
  mode: 'ios', // Use iOS animations globally for smoother feel
  animated: true,
  swipeBackEnabled: true
});

// Loading component for lazy-loaded routes
const RouteLoadingFallback: React.FC = () => (
  <IonContent className="ion-padding">
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%'
    }}>
      <IonSpinner name="crescent" />
    </div>
  </IonContent>
);

const App: React.FC = () => {
  const initializeTheme = useResQLinkStore(state => state.initializeTheme);

  useEffect(() => {
    // Initialize theme system on app startup
    initializeTheme();

    // Start battery monitoring on app initialization
    startBatteryMonitoring().catch((error) => {
      console.warn('Failed to start battery monitoring:', error);
    });

    // Log performance summary every 5 minutes in dev mode
    let summaryInterval: NodeJS.Timeout | undefined;
    if (import.meta.env.DEV) {
      summaryInterval = setInterval(() => {
        logPerformanceSummary();
      }, 5 * 60 * 1000); // 5 minutes
    }

    // Cleanup on unmount
    return () => {
      stopBatteryMonitoring();
      if (summaryInterval) {
        clearInterval(summaryInterval);
      }
    };
  }, [initializeTheme]);

  return (
    <IonApp>
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        className="skip-nav-link"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet id="main-content">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Route exact path="/messages">
                <MessagesPage />
              </Route>
              <Route exact path="/groups">
                <GroupsPage />
              </Route>
              <Route path="/resources">
                <ResourcesPage />
              </Route>
              <Route path="/settings">
                <SettingsPage />
              </Route>
              <Route exact path="/">
                <Redirect to="/messages" />
              </Route>
            </Suspense>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="messages" href="/messages">
              <IonIcon aria-hidden="true" icon={chatbubbleEllipses} />
              <IonLabel>Messages</IonLabel>
            </IonTabButton>
            <IonTabButton tab="groups" href="/groups">
              <IonIcon aria-hidden="true" icon={people} />
              <IonLabel>Groups</IonLabel>
            </IonTabButton>
            <IonTabButton tab="resources" href="/resources">
              <IonIcon aria-hidden="true" icon={map} />
              <IonLabel>Resources</IonLabel>
            </IonTabButton>
            <IonTabButton tab="settings" href="/settings">
              <IonIcon aria-hidden="true" icon={settings} />
              <IonLabel>Settings</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
      <PWAUpdateNotification />
    </IonApp>
  );
};

export default App;
