const NotFound = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white bg-gray-900">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-lg mb-6">Page not found</p>
        <a href="/home" className="text-blue-400 underline">Go back to Home</a>
      </div>
    );
  };
  
  export default NotFound;
  