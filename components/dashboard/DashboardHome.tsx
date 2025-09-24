import React from 'react';


// interface DashHomeProps {
//     // add props here
// }

const DashHome: React.FC = () => {
    return (
        <>
            <main>
                <div className="grid grid-cols-5 grid-rows-5 gap-4 border-2 border-black">
                    <div className="col-span-5 row-span-2 border-2 border-red-500">1</div>
                    <div className="col-span-3 row-span-3 row-start-3 border-2 border-red-500">2</div>
                    <div className="col-span-2 row-span-3 col-start-4 row-start-3 border-2 border-red-500">3</div>
                </div>
            </main>
        </>
    );
};

export default DashHome;
