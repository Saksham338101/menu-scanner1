// Simple test component to debug white screen issue
export const TestComponent = () => {
    return (
        <div className="min-h-screen bg-blue-100 p-8">
            <h1 className="text-4xl font-bold text-blue-800">Test Component Working!</h1>
            <p className="text-lg text-blue-600 mt-4">If you can see this, React is working fine.</p>
        </div>
    );
};