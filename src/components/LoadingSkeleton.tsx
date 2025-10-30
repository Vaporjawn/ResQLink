/**
 * ResQLink - Loading Skeleton Component
 * Provides skeleton screens for better loading experience
 */

import React from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonSkeletonText,
  IonLabel,
  IonAvatar,
  IonCard,
  IonCardHeader,
  IonCardContent
} from '@ionic/react';
import './LoadingSkeleton.css';

interface LoadingSkeletonProps {
  type: 'messages' | 'groups' | 'chat' | 'map';
}

/**
 * Messages Page Loading Skeleton
 */
const MessagesListSkeleton: React.FC = () => {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonSkeletonText animated style={{ width: '120px', height: '24px' }} />
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <IonItem key={i}>
              <IonAvatar slot="start">
                <IonSkeletonText animated />
              </IonAvatar>
              <IonLabel>
                <h2>
                  <IonSkeletonText animated style={{ width: '60%' }} />
                </h2>
                <p>
                  <IonSkeletonText animated style={{ width: '80%' }} />
                </p>
              </IonLabel>
              <IonSkeletonText animated slot="end" style={{ width: '50px', height: '16px' }} />
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </>
  );
};

/**
 * Groups Page Loading Skeleton
 */
const GroupsListSkeleton: React.FC = () => {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonSkeletonText animated style={{ width: '100px', height: '24px' }} />
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {[1, 2, 3, 4, 5].map((i) => (
            <IonItem key={i}>
              <IonAvatar slot="start">
                <IonSkeletonText animated />
              </IonAvatar>
              <IonLabel>
                <h2>
                  <IonSkeletonText animated style={{ width: '70%' }} />
                </h2>
                <p>
                  <IonSkeletonText animated style={{ width: '40%' }} />
                </p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </>
  );
};

/**
 * Chat Interface Loading Skeleton
 */
const ChatSkeleton: React.FC = () => {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonSkeletonText animated style={{ width: '150px', height: '24px' }} />
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Other person's message */}
          <div style={{ maxWidth: '70%', alignSelf: 'flex-start' }}>
            <IonSkeletonText animated style={{ width: '100%', height: '60px', borderRadius: '12px' }} />
          </div>

          {/* Own message */}
          <div style={{ maxWidth: '70%', alignSelf: 'flex-end' }}>
            <IonSkeletonText animated style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
          </div>

          {/* Other person's message */}
          <div style={{ maxWidth: '70%', alignSelf: 'flex-start' }}>
            <IonSkeletonText animated style={{ width: '100%', height: '80px', borderRadius: '12px' }} />
          </div>

          {/* Own message */}
          <div style={{ maxWidth: '70%', alignSelf: 'flex-end' }}>
            <IonSkeletonText animated style={{ width: '100%', height: '40px', borderRadius: '12px' }} />
          </div>
        </div>
      </IonContent>
    </>
  );
};

/**
 * Map Loading Skeleton
 */
const MapSkeleton: React.FC = () => {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonSkeletonText animated style={{ width: '140px', height: '24px' }} />
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: '16px' }}>
          {/* Map placeholder */}
          <IonCard>
            <IonSkeletonText animated style={{ width: '100%', height: '400px' }} />
          </IonCard>

          {/* Resource cards */}
          <IonCard>
            <IonCardHeader>
              <IonSkeletonText animated style={{ width: '60%', height: '24px' }} />
            </IonCardHeader>
            <IonCardContent>
              <IonSkeletonText animated style={{ width: '100%' }} />
              <IonSkeletonText animated style={{ width: '80%' }} />
              <IonSkeletonText animated style={{ width: '90%' }} />
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonSkeletonText animated style={{ width: '50%', height: '24px' }} />
            </IonCardHeader>
            <IonCardContent>
              <IonSkeletonText animated style={{ width: '100%' }} />
              <IonSkeletonText animated style={{ width: '70%' }} />
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </>
  );
};

/**
 * Main Loading Skeleton Component
 */
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type }) => {
  switch (type) {
    case 'messages':
      return <MessagesListSkeleton />;
    case 'groups':
      return <GroupsListSkeleton />;
    case 'chat':
      return <ChatSkeleton />;
    case 'map':
      return <MapSkeleton />;
    default:
      return <MessagesListSkeleton />;
  }
};

export default LoadingSkeleton;
