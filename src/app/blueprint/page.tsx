export default function BlueprintPage() {
  return (
    <div className="w-full max-w-none p-6 md:p-8 pb-24 min-h-0 flex flex-col premium-enter">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">Configuration Blueprint</h1>
        <p className="text-zinc-400">
          Define your core AI application parameters. Upload your master document and restrict the logic funnel.
        </p>
      </div>
      <ConfigurationBlueprint />
    </div>
  );
}

// Importing the actual functional client component:
import { ConfigurationBlueprint } from '@/components/ConfigurationBlueprint';
