import React, { useState, useEffect, useCallback } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonItem,
  IonLabel,
  IonBadge,
  IonProgressBar,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonList,
  IonNote,
  IonToggle,
  IonInput,
  IonToast,
  IonChip
} from '@ionic/react';
import {
  checkmarkCircle,
  closeCircle,
  warningOutline,
  keyOutline,
  personOutline,
  shieldCheckmarkOutline,
  copyOutline,
  timeOutline,
  peopleOutline,
  cloudOutline,
  eyeOutline,
  eyeOffOutline,
  fingerPrintOutline,
  settingsOutline
} from 'ionicons/icons';
import { useResQLinkStore } from '../lib/store';
import { generateKeyPair } from '../lib/crypto';
import type { AppSettings } from '../lib/schema';

interface AuthTestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: string;
  duration?: number;
}

interface SecurityMetrics {
  keyStrength: number;
  aliasComplexity: number;
  networkSecurity: number;
  privacyScore: number;
  configurationHealth: number;
  overallScore: number;
}

const AuthenticationTest: React.FC = () => {
  // Store state
  const { 
    keyPair, 
    isInitialized, 
    settings, 
    meshStatus, 
    contacts, 
    initializeNode, 
    updateSettings,
    addContact,
    removeContact 
  } = useResQLinkStore();

  // Component state
  const [testResults, setTestResults] = useState<AuthTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    keyStrength: 0,
    aliasComplexity: 0,
    networkSecurity: 0,
    privacyScore: 0,
    configurationHealth: 0,
    overallScore: 0
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [testAlias, setTestAlias] = useState('TestUser123');


  // Test configuration
  const [includePerformanceTests, setIncludePerformanceTests] = useState(true);
  const [includeSecurityTests, setIncludeSecurityTests] = useState(true);
  const [includeIntegrationTests, setIncludeIntegrationTests] = useState(true);
  const [stressTestIterations] = useState(100);

  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    keyGenerationTime: 0,
    aliasUpdateTime: 0,
    settingsUpdateTime: 0,
    contactOperationTime: 0,
    averageOperationTime: 0
  });

  /**
   * Calculate comprehensive security metrics
   */
  const calculateSecurityMetrics = useCallback((): SecurityMetrics => {
    let keyStrength = 0;
    let aliasComplexity = 0;
    let networkSecurity = 0;
    let privacyScore = 0;
    let configurationHealth = 0;

    // Key strength assessment (0-100)
    if (isInitialized && keyPair) {
      keyStrength += 30; // Basic initialization
      
      const keyAge = keyPair.createdAt ? Date.now() - keyPair.createdAt : 0;
      if (keyAge < 30 * 24 * 60 * 60 * 1000) keyStrength += 25; // Fresh keys
      
      if (keyPair.ed25519Pub && keyPair.x25519Pub) keyStrength += 25; // Both key types
      if (keyPair.ed25519Sec && keyPair.x25519Sec) keyStrength += 20; // Complete key pair
    }

    // Alias complexity (0-100)
    if (settings.userAlias && settings.userAlias !== 'Anonymous') {
      aliasComplexity += 40;
      if (settings.userAlias.length >= 8) aliasComplexity += 20;
      if (/[A-Z]/.test(settings.userAlias)) aliasComplexity += 10;
      if (/[0-9]/.test(settings.userAlias)) aliasComplexity += 10;
      if (/[!@#$%^&*(),.?":{}|<>]/.test(settings.userAlias)) aliasComplexity += 20;
    }

    // Network security (0-100)
    if (meshStatus.active) networkSecurity += 25;
    if (meshStatus.peerCount > 0) networkSecurity += 25;
    if (meshStatus.batteryOptimized) networkSecurity += 20;
    if (!meshStatus.discovering) networkSecurity += 15; // Not broadcasting
    if (meshStatus.serviceId) networkSecurity += 15;

    // Privacy score (0-100)
    if (!settings.includeLocationDefault) privacyScore += 30;
    if (!settings.gatewayEnabled) privacyScore += 20;
    if (settings.highContrast) privacyScore += 10; // Accessibility consideration
    if (contacts.length > 0) privacyScore += 20; // Has trusted contacts
    if (settings.language === 'en') privacyScore += 20; // Default language

    // Configuration health (0-100)
    if (settings.userAlias) configurationHealth += 20;
    if (settings.gatewayConfig?.authToken) configurationHealth += 25;
    if (settings.relayMode?.enabled !== undefined) configurationHealth += 25;
    if (settings.includeLocationDefault) configurationHealth += 15;
    if (settings.highContrast !== undefined) configurationHealth += 10;

    const overallScore = Math.round(
      (keyStrength + aliasComplexity + networkSecurity + privacyScore + configurationHealth) / 5
    );

    return {
      keyStrength: Math.min(keyStrength, 100),
      aliasComplexity: Math.min(aliasComplexity, 100),
      networkSecurity: Math.min(networkSecurity, 100),
      privacyScore: Math.min(privacyScore, 100),
      configurationHealth: Math.min(configurationHealth, 100),
      overallScore: Math.min(overallScore, 100)
    };
  }, [isInitialized, keyPair, settings, meshStatus, contacts]);

  /**
   * Individual test functions
   */
  const testKeyGeneration = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      const newKeyPair = await generateKeyPair();
      const endTime = performance.now();
      const duration = endTime - startTime;

      setPerformanceMetrics(prev => ({ ...prev, keyGenerationTime: duration }));

      if (!newKeyPair) {
        return {
          test: 'Key Generation',
          status: 'fail',
          message: 'Failed to generate key pair',
          duration
        };
      }

      if (!newKeyPair.ed25519Pub || !newKeyPair.ed25519Sec || 
          !newKeyPair.x25519Pub || !newKeyPair.x25519Sec) {
        return {
          test: 'Key Generation',
          status: 'fail',
          message: 'Incomplete key pair generated',
          details: `Missing keys: ${Object.entries(newKeyPair).filter(([, v]) => !v).map(([k]) => k).join(', ')}`,
          duration
        };
      }

      return {
        test: 'Key Generation',
        status: 'pass',
        message: `Generated complete key pair in ${duration.toFixed(2)}ms`,
        details: `Ed25519 pub: ${newKeyPair.ed25519Pub.substring(0, 16)}..., X25519 pub: ${newKeyPair.x25519Pub.substring(0, 16)}...`,
        duration
      };
    } catch (error) {
      return {
        test: 'Key Generation',
        status: 'fail',
        message: `Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testNodeInitialization = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      
      if (!isInitialized) {
        await initializeNode();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!isInitialized) {
        return {
          test: 'Node Initialization',
          status: 'fail',
          message: 'Node failed to initialize',
          duration
        };
      }

      if (!keyPair) {
        return {
          test: 'Node Initialization',
          status: 'fail',
          message: 'Node initialized but no key pair available',
          duration
        };
      }

      return {
        test: 'Node Initialization',
        status: 'pass',
        message: `Node initialized successfully in ${duration.toFixed(2)}ms`,
        details: `Service ID: ${meshStatus.serviceId || 'Not set'}`,
        duration
      };
    } catch (error) {
      return {
        test: 'Node Initialization',
        status: 'fail',
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testAliasManagement = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      const originalAlias = settings.userAlias;
      
      // Test alias update
      updateSettings({ userAlias: testAlias });
      
      // Verify update
      if (settings.userAlias !== testAlias) {
        return {
          test: 'Alias Management',
          status: 'fail',
          message: 'Failed to update user alias'
        };
      }

      // Restore original alias
      updateSettings({ userAlias: originalAlias });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setPerformanceMetrics(prev => ({ ...prev, aliasUpdateTime: duration }));

      return {
        test: 'Alias Management',
        status: 'pass',
        message: `Alias management working correctly in ${duration.toFixed(2)}ms`,
        details: `Test alias: ${testAlias}, Original: ${originalAlias}`,
        duration
      };
    } catch (error) {
      return {
        test: 'Alias Management',
        status: 'fail',
        message: `Alias management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testContactManagement = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      const originalContactCount = contacts.length;
      
      const testContactData = {
        alias: 'Test Contact',
        ed25519Pub: 'test-ed25519-pub-' + Math.random().toString(36).substring(2),
        x25519Pub: 'test-x25519-pub-' + Math.random().toString(36).substring(2)
      };

      // Add contact
      addContact(testContactData.alias, testContactData.ed25519Pub, testContactData.x25519Pub);
      
      if (contacts.length !== originalContactCount + 1) {
        return {
          test: 'Contact Management',
          status: 'fail',
          message: 'Failed to add contact'
        };
      }

      // Remove contact
      removeContact(testContactData.ed25519Pub);
      
      if (contacts.length !== originalContactCount) {
        return {
          test: 'Contact Management',
          status: 'fail',
          message: 'Failed to remove contact'
        };
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setPerformanceMetrics(prev => ({ ...prev, contactOperationTime: duration }));

      return {
        test: 'Contact Management',
        status: 'pass',
        message: `Contact management working correctly in ${duration.toFixed(2)}ms`,
        details: `Added and removed test contact successfully`,
        duration
      };
    } catch (error) {
      return {
        test: 'Contact Management',
        status: 'fail',
        message: `Contact management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testSettingsPersistence = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      const originalSettings = { ...settings };
      
      const testSettings = {
        gatewayEnabled: !settings.gatewayEnabled,
        highContrast: !settings.highContrast,
        includeLocationDefault: !settings.includeLocationDefault,
        language: (settings.language === 'en' ? 'ur' : 'en') as 'en' | 'ur'
      };

      // Update settings
      updateSettings(testSettings);
      
      // Verify updates
      const verificationFailed = Object.entries(testSettings).some(([key, value]) => {
        return settings[key as keyof AppSettings] !== value;
      });

      if (verificationFailed) {
        return {
          test: 'Settings Persistence',
          status: 'fail',
          message: 'Settings update verification failed'
        };
      }

      // Restore original settings
      updateSettings(originalSettings);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setPerformanceMetrics(prev => ({ ...prev, settingsUpdateTime: duration }));

      return {
        test: 'Settings Persistence',
        status: 'pass',
        message: `Settings persistence working correctly in ${duration.toFixed(2)}ms`,
        details: `Updated and restored ${Object.keys(testSettings).length} settings`,
        duration
      };
    } catch (error) {
      return {
        test: 'Settings Persistence',
        status: 'fail',
        message: `Settings persistence failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testSecurityValidation = async (): Promise<AuthTestResult> => {
    try {
      const metrics = calculateSecurityMetrics();
      
      if (metrics.overallScore < 50) {
        return {
          test: 'Security Validation',
          status: 'warning',
          message: `Security score below threshold: ${metrics.overallScore}%`,
          details: `Key: ${metrics.keyStrength}%, Alias: ${metrics.aliasComplexity}%, Network: ${metrics.networkSecurity}%, Privacy: ${metrics.privacyScore}%, Config: ${metrics.configurationHealth}%`
        };
      }

      if (metrics.overallScore < 75) {
        return {
          test: 'Security Validation',
          status: 'warning',
          message: `Security score needs improvement: ${metrics.overallScore}%`,
          details: 'Consider improving key management, alias complexity, or privacy settings'
        };
      }

      return {
        test: 'Security Validation',
        status: 'pass',
        message: `Strong security configuration: ${metrics.overallScore}%`,
        details: `All security metrics above acceptable thresholds`
      };
    } catch (error) {
      return {
        test: 'Security Validation',
        status: 'fail',
        message: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const testStressOperations = async (): Promise<AuthTestResult> => {
    try {
      const startTime = performance.now();
      const operationTimes: number[] = [];

      for (let i = 0; i < Math.min(stressTestIterations, 50); i++) {
        const opStart = performance.now();
        
        // Perform rapid settings updates
        updateSettings({ 
          userAlias: `StressTest${i}`,
          gatewayEnabled: i % 2 === 0 
        });
        
        const opEnd = performance.now();
        operationTimes.push(opEnd - opStart);
        
        // Update progress
        setProgress(0.5 + (i / (stressTestIterations * 2)));
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const avgOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
      
      setPerformanceMetrics(prev => ({ ...prev, averageOperationTime: avgOperationTime }));

      // Restore original settings
      updateSettings({ userAlias: 'Anonymous', gatewayEnabled: false });

      if (avgOperationTime > 50) {
        return {
          test: 'Stress Operations',
          status: 'warning',
          message: `Performance degradation detected: ${avgOperationTime.toFixed(2)}ms average`,
          details: `${operationTimes.length} operations in ${totalDuration.toFixed(2)}ms`,
          duration: totalDuration
        };
      }

      return {
        test: 'Stress Operations',
        status: 'pass',
        message: `Stress test completed successfully: ${avgOperationTime.toFixed(2)}ms average`,
        details: `${operationTimes.length} operations in ${totalDuration.toFixed(2)}ms`,
        duration: totalDuration
      };
    } catch (error) {
      return {
        test: 'Stress Operations',
        status: 'fail',
        message: `Stress test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  /**
   * Run comprehensive authentication tests
   */
  const runAuthenticationTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setProgress(0);
    
    const tests: Array<() => Promise<AuthTestResult>> = [
      testKeyGeneration,
      testNodeInitialization,
      testAliasManagement,
      testContactManagement,
      testSettingsPersistence
    ];

    if (includeSecurityTests) {
      tests.push(testSecurityValidation);
    }

    if (includePerformanceTests) {
      tests.push(testStressOperations);
    }

    const results: AuthTestResult[] = [];

    try {
      for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        setCurrentTest(test.name || `Test ${i + 1}`);
        setProgress((i / tests.length));

        const result = await test();
        results.push(result);
        setTestResults([...results]);

        // Short delay for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate and update security metrics
      const metrics = calculateSecurityMetrics();
      setSecurityMetrics(metrics);

      setProgress(1);
      setCurrentTest('');
      
      const passCount = results.filter(r => r.status === 'pass').length;
      const failCount = results.filter(r => r.status === 'fail').length;
      const warnCount = results.filter(r => r.status === 'warning').length;

      setToastMessage(`Authentication tests completed: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
      setShowToast(true);

    } catch (error) {
      console.error('Test execution error:', error);
      setToastMessage(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowToast(true);
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Copy test results to clipboard
   */
  const copyTestResults = async () => {
    try {
      const timestamp = new Date().toISOString();
      const report = `ResQLink Authentication Test Report
Generated: ${timestamp}

Security Metrics:
- Overall Score: ${securityMetrics.overallScore}%
- Key Strength: ${securityMetrics.keyStrength}%
- Alias Complexity: ${securityMetrics.aliasComplexity}%
- Network Security: ${securityMetrics.networkSecurity}%
- Privacy Score: ${securityMetrics.privacyScore}%
- Configuration Health: ${securityMetrics.configurationHealth}%

Performance Metrics:
- Key Generation: ${performanceMetrics.keyGenerationTime.toFixed(2)}ms
- Alias Update: ${performanceMetrics.aliasUpdateTime.toFixed(2)}ms
- Settings Update: ${performanceMetrics.settingsUpdateTime.toFixed(2)}ms
- Contact Operations: ${performanceMetrics.contactOperationTime.toFixed(2)}ms
- Average Operation: ${performanceMetrics.averageOperationTime.toFixed(2)}ms

Test Results:
${testResults.map(result => `
${result.test}: ${result.status.toUpperCase()}
Message: ${result.message}
${result.details ? `Details: ${result.details}` : ''}
${result.duration ? `Duration: ${result.duration.toFixed(2)}ms` : ''}
`).join('\n')}

System State:
- Initialized: ${isInitialized}
- User Alias: ${settings.userAlias}
- Mesh Active: ${meshStatus.active}
- Peer Count: ${meshStatus.peerCount}
- Contacts: ${contacts.length}
- Gateway Enabled: ${settings.gatewayEnabled}
`;

      await navigator.clipboard.writeText(report);
      setToastMessage('Test report copied to clipboard');
      setShowToast(true);
    } catch (error) {
      console.error('Failed to copy test results:', error);
      setToastMessage('Failed to copy test report');
      setShowToast(true);
    }
  };

  /**
   * Initialize security metrics on component mount
   */
  useEffect(() => {
    const metrics = calculateSecurityMetrics();
    setSecurityMetrics(metrics);
  }, [isInitialized, keyPair, settings, meshStatus, contacts, calculateSecurityMetrics]);

  /**
   * Get status color for test results
   */
  const getStatusColor = (status: AuthTestResult['status']) => {
    switch (status) {
      case 'pass': return 'success';
      case 'fail': return 'danger';
      case 'warning': return 'warning';
      case 'pending': return 'medium';
      default: return 'medium';
    }
  };

  /**
   * Get status icon for test results
   */
  const getStatusIcon = (status: AuthTestResult['status']) => {
    switch (status) {
      case 'pass': return checkmarkCircle;
      case 'fail': return closeCircle;
      case 'warning': return warningOutline;
      case 'pending': return timeOutline;
      default: return timeOutline;
    }
  };

  /**
   * Get security score color
   */
  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Header Section */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Authentication System Testing</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p>Comprehensive testing suite for ResQLink's authentication and security systems.</p>
          
          {/* Test Configuration */}
          <IonList>
            <IonItem>
              <IonIcon icon={settingsOutline} slot="start" />
              <IonLabel>Include Performance Tests</IonLabel>
              <IonToggle 
                checked={includePerformanceTests} 
                onIonChange={(e) => setIncludePerformanceTests(e.detail.checked)} 
              />
            </IonItem>
            <IonItem>
              <IonIcon icon={shieldCheckmarkOutline} slot="start" />
              <IonLabel>Include Security Tests</IonLabel>
              <IonToggle 
                checked={includeSecurityTests} 
                onIonChange={(e) => setIncludeSecurityTests(e.detail.checked)} 
              />
            </IonItem>
            <IonItem>
              <IonIcon icon={peopleOutline} slot="start" />
              <IonLabel>Include Integration Tests</IonLabel>
              <IonToggle 
                checked={includeIntegrationTests} 
                onIonChange={(e) => setIncludeIntegrationTests(e.detail.checked)} 
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Test Alias</IonLabel>
              <IonInput 
                value={testAlias} 
                onIonInput={(e) => setTestAlias(e.detail.value!)} 
                placeholder="Enter test alias"
              />
            </IonItem>
          </IonList>

          <IonButton 
            expand="block" 
            onClick={runAuthenticationTests}
            disabled={isRunning}
            style={{ marginTop: '16px' }}
          >
            <IonIcon icon={fingerPrintOutline} slot="start" />
            {isRunning ? 'Running Tests...' : 'Run Authentication Tests'}
          </IonButton>

          {isRunning && (
            <div style={{ marginTop: '16px' }}>
              <IonProgressBar value={progress} />
              <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px' }}>
                {currentTest && `Running: ${currentTest}`}
              </p>
            </div>
          )}
        </IonCardContent>
      </IonCard>

      {/* Security Metrics Dashboard */}
      {testResults.length > 0 && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Security Metrics Dashboard</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="12" sizeMd="6">
                  <div style={{ textAlign: 'center' }}>
                    <h2>Overall Security Score</h2>
                    <IonBadge 
                      color={getSecurityScoreColor(securityMetrics.overallScore)}
                      style={{ fontSize: '24px', padding: '12px 20px' }}
                    >
                      {securityMetrics.overallScore}%
                    </IonBadge>
                  </div>
                </IonCol>
                <IonCol size="12" sizeMd="6">
                  <IonList>
                    <IonItem>
                      <IonIcon icon={keyOutline} slot="start" />
                      <IonLabel>
                        <h3>Key Strength</h3>
                        <IonProgressBar 
                          value={securityMetrics.keyStrength / 100} 
                          color={getSecurityScoreColor(securityMetrics.keyStrength)}
                        />
                      </IonLabel>
                      <IonNote slot="end">{securityMetrics.keyStrength}%</IonNote>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={personOutline} slot="start" />
                      <IonLabel>
                        <h3>Alias Complexity</h3>
                        <IonProgressBar 
                          value={securityMetrics.aliasComplexity / 100} 
                          color={getSecurityScoreColor(securityMetrics.aliasComplexity)}
                        />
                      </IonLabel>
                      <IonNote slot="end">{securityMetrics.aliasComplexity}%</IonNote>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={peopleOutline} slot="start" />
                      <IonLabel>
                        <h3>Network Security</h3>
                        <IonProgressBar 
                          value={securityMetrics.networkSecurity / 100} 
                          color={getSecurityScoreColor(securityMetrics.networkSecurity)}
                        />
                      </IonLabel>
                      <IonNote slot="end">{securityMetrics.networkSecurity}%</IonNote>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={eyeOffOutline} slot="start" />
                      <IonLabel>
                        <h3>Privacy Score</h3>
                        <IonProgressBar 
                          value={securityMetrics.privacyScore / 100} 
                          color={getSecurityScoreColor(securityMetrics.privacyScore)}
                        />
                      </IonLabel>
                      <IonNote slot="end">{securityMetrics.privacyScore}%</IonNote>
                    </IonItem>
                    <IonItem>
                      <IonIcon icon={settingsOutline} slot="start" />
                      <IonLabel>
                        <h3>Configuration Health</h3>
                        <IonProgressBar 
                          value={securityMetrics.configurationHealth / 100} 
                          color={getSecurityScoreColor(securityMetrics.configurationHealth)}
                        />
                      </IonLabel>
                      <IonNote slot="end">{securityMetrics.configurationHealth}%</IonNote>
                    </IonItem>
                  </IonList>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>
      )}

      {/* Performance Metrics */}
      {testResults.length > 0 && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Performance Metrics</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="12" sizeMd="6">
                  <IonItem>
                    <IonIcon icon={keyOutline} slot="start" />
                    <IonLabel>
                      <h3>Key Generation Time</h3>
                      <p>{performanceMetrics.keyGenerationTime.toFixed(2)}ms</p>
                    </IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonIcon icon={personOutline} slot="start" />
                    <IonLabel>
                      <h3>Alias Update Time</h3>
                      <p>{performanceMetrics.aliasUpdateTime.toFixed(2)}ms</p>
                    </IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonIcon icon={settingsOutline} slot="start" />
                    <IonLabel>
                      <h3>Settings Update Time</h3>
                      <p>{performanceMetrics.settingsUpdateTime.toFixed(2)}ms</p>
                    </IonLabel>
                  </IonItem>
                </IonCol>
                <IonCol size="12" sizeMd="6">
                  <IonItem>
                    <IonIcon icon={peopleOutline} slot="start" />
                    <IonLabel>
                      <h3>Contact Operation Time</h3>
                      <p>{performanceMetrics.contactOperationTime.toFixed(2)}ms</p>
                    </IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonIcon icon={timeOutline} slot="start" />
                    <IonLabel>
                      <h3>Average Operation Time</h3>
                      <p>{performanceMetrics.averageOperationTime.toFixed(2)}ms</p>
                    </IonLabel>
                  </IonItem>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              Test Results
              <IonButton 
                fill="clear" 
                size="small" 
                onClick={copyTestResults}
                style={{ float: 'right' }}
              >
                <IonIcon icon={copyOutline} />
              </IonButton>
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              {testResults.map((result, index) => (
                <IonItem key={index}>
                  <IonIcon 
                    icon={getStatusIcon(result.status)} 
                    color={getStatusColor(result.status)}
                    slot="start" 
                  />
                  <IonLabel>
                    <h3>{result.test}</h3>
                    <p>{result.message}</p>
                    {result.details && (
                      <IonNote>
                        <small>{result.details}</small>
                      </IonNote>
                    )}
                  </IonLabel>
                  {result.duration && (
                    <IonNote slot="end">{result.duration.toFixed(2)}ms</IonNote>
                  )}
                </IonItem>
              ))}
            </IonList>

            {/* Test Summary */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <IonChip color="success">
                <IonLabel>{testResults.filter(r => r.status === 'pass').length} Passed</IonLabel>
              </IonChip>
              <IonChip color="warning">
                <IonLabel>{testResults.filter(r => r.status === 'warning').length} Warnings</IonLabel>
              </IonChip>
              <IonChip color="danger">
                <IonLabel>{testResults.filter(r => r.status === 'fail').length} Failed</IonLabel>
              </IonChip>
            </div>
          </IonCardContent>
        </IonCard>
      )}

      {/* Current System Status */}
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Current System Status</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonList>
            <IonItem>
              <IonIcon icon={shieldCheckmarkOutline} slot="start" />
              <IonLabel>
                <h3>Node Initialization</h3>
                <p>{isInitialized ? 'Initialized' : 'Not initialized'}</p>
              </IonLabel>
              <IonBadge color={isInitialized ? 'success' : 'danger'}>
                {isInitialized ? 'Active' : 'Inactive'}
              </IonBadge>
            </IonItem>
            
            <IonItem>
              <IonIcon icon={personOutline} slot="start" />
              <IonLabel>
                <h3>User Alias</h3>
                <p>{settings.userAlias}</p>
              </IonLabel>
            </IonItem>

            <IonItem>
              <IonIcon icon={keyOutline} slot="start" />
              <IonLabel>
                <h3>Cryptographic Keys</h3>
                <p>{keyPair ? 'Available' : 'Not available'}</p>
              </IonLabel>
              {keyPair && (
                <IonButton 
                  fill="clear" 
                  size="small"
                  onClick={() => setShowKeyDetails(!showKeyDetails)}
                >
                  <IonIcon icon={showKeyDetails ? eyeOffOutline : eyeOutline} />
                </IonButton>
              )}
            </IonItem>

            {showKeyDetails && keyPair && (
              <>
                <IonItem>
                  <IonLabel>
                    <h4>Ed25519 Public Key</h4>
                    <IonNote style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                      {keyPair.ed25519Pub}
                    </IonNote>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h4>X25519 Public Key</h4>
                    <IonNote style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                      {keyPair.x25519Pub}
                    </IonNote>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h4>Created At</h4>
                    <IonNote>
                      {keyPair.createdAt ? new Date(keyPair.createdAt).toLocaleString() : 'Unknown'}
                    </IonNote>
                  </IonLabel>
                </IonItem>
              </>
            )}

            <IonItem>
              <IonIcon icon={peopleOutline} slot="start" />
              <IonLabel>
                <h3>Mesh Network</h3>
                <p>{meshStatus.active ? 'Active' : 'Inactive'} - {meshStatus.peerCount} peers</p>
              </IonLabel>
              <IonBadge color={meshStatus.active ? 'success' : 'medium'}>
                {meshStatus.active ? 'Connected' : 'Disconnected'}
              </IonBadge>
            </IonItem>

            <IonItem>
              <IonIcon icon={peopleOutline} slot="start" />
              <IonLabel>
                <h3>Contacts</h3>
                <p>{contacts.length} contacts stored</p>
              </IonLabel>
            </IonItem>

            <IonItem>
              <IonIcon icon={cloudOutline} slot="start" />
              <IonLabel>
                <h3>Gateway Uplink</h3>
                <p>{settings.gatewayEnabled ? 'Enabled' : 'Disabled'}</p>
              </IonLabel>
              <IonBadge color={settings.gatewayEnabled ? 'success' : 'medium'}>
                {settings.gatewayEnabled ? 'On' : 'Off'}
              </IonBadge>
            </IonItem>
          </IonList>
        </IonCardContent>
      </IonCard>

      {/* Toast for notifications */}
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
      />
    </div>
  );
};

export default AuthenticationTest;