import { AccountType } from '@/components';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            MyFans Account Types
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Decentralized content subscription platform on Stellar
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card-base rounded-lg p-6 border">
            <AccountType status="creator" />
          </div>

          <div className="card-base rounded-lg p-6 border">
            <AccountType status="fan" />
          </div>

          <div className="card-base rounded-lg p-6 border">
            <AccountType status="both" />
          </div>

          <div className="card-base rounded-lg p-6 border">
            <AccountType status="none" />
          </div>
        </div>

        <div className="card-base rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Usage Example
          </h2>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-x-auto">
            <code>{`import { AccountType } from '@/components';

<AccountType status="creator" />
<AccountType status="fan" />
<AccountType status="both" />
<AccountType status="none" />`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
