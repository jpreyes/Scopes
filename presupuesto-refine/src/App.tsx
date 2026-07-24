import { Refine, Authenticated } from '@refinedev/core'
import {
  ThemedLayoutV2,
  ThemedTitleV2,
  notificationProvider,
  AuthPage,
  ErrorComponent,
} from '@refinedev/antd'
import routerProvider from '@refinedev/react-router-v6'
import { ConfigProvider } from 'antd'
import '@refinedev/antd/dist/reset.css'

import { pocketbaseDataProvider } from './providers/dataProvider'
import { authProvider } from './providers/authProvider'
import { ensureAuth } from './providers/pocketbaseClient'

import { Dashboard } from './pages/Dashboard'
import { DealsKanban } from './pages/DealsKanban'
import { ClientList } from './pages/ClientList'
import { ClientCreate } from './pages/ClientCreate'
import { ClientEdit } from './pages/ClientEdit'
import { ClientShow } from './pages/ClientShow'
import { QuoteList } from './pages/QuoteList'
import { QuoteCreate } from './pages/QuoteCreate'
import { QuoteEdit } from './pages/QuoteEdit'
import { QuoteShow } from './pages/QuoteShow'
import { GanttPage } from './pages/GanttPage'
import { CosteoPage } from './pages/CosteoPage'

ensureAuth()

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1a2a3a',
          borderRadius: 8,
        },
      }}
    >
      <Refine
        dataProvider={pocketbaseDataProvider}
        routerProvider={routerProvider}
        authProvider={authProvider}
        resources={[
          {
            name: 'dashboard',
            list: '/',
            meta: { label: 'Dashboard' },
          },
          {
            name: 'deals',
            list: '/deals',
            meta: { label: 'Oportunidades' },
          },
          {
            name: 'clients',
            list: '/clients',
            create: '/clients/create',
            edit: '/clients/edit/:id',
            show: '/clients/show/:id',
            meta: { label: 'Clientes' },
          },
          {
            name: 'quotes',
            list: '/quotes',
            create: '/quotes/create',
            edit: '/quotes/edit/:id',
            show: '/quotes/show/:id',
            meta: { label: 'Cotizaciones' },
          },
          {
            name: 'gantt',
            list: '/gantt',
            meta: { label: 'Carta Gantt' },
          },
          {
            name: 'costeo',
            list: '/costeo',
            meta: { label: 'Costeo Interno' },
          },
        ]}
        notificationProvider={notificationProvider}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
        }}
      >
        <Authenticated key="auth" fallback={<AuthPage type="login" />}>
          <ThemedLayoutV2
            Title={({ collapsed }: { collapsed: boolean }) => (
              <ThemedTitleV2 collapsed={collapsed} text="Presupuesto Rápido" />
            )}
          >
            <Dashboard />
            <DealsKanban />
            <ClientList />
            <ClientCreate />
            <ClientEdit />
            <ClientShow />
            <QuoteList />
            <QuoteCreate />
            <QuoteEdit />
            <QuoteShow />
            <GanttPage />
            <CosteoPage />
            <ErrorComponent />
          </ThemedLayoutV2>
        </Authenticated>
      </Refine>
    </ConfigProvider>
  )
}

export default App
