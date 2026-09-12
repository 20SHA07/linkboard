import Dashboard from '@/components/dashboard';
import SetupGuide from '@/components/setup-guide';
import { needsBackendSetup } from '@/lib/backend-config';
export default function Home() {
  return needsBackendSetup ? <SetupGuide /> : <Dashboard />;
}
