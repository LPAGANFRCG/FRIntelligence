import { SplitWorkspace } from '@/components/SplitWorkspace';

export default function HomePage() {
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#0b0d11] text-[#ffffff] font-sans antialiased">
      <SplitWorkspace />
    </div>
  );
}
