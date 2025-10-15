import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Layout from "./Layout";

//Libraries
import { createBrowserRouter,Route,createRoutesFromElements,RouterProvider} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Admin from "./pages/Admin";
import Lottery from "./pages/Lottery";


const App = () => {

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Layout />}>
        <Route path="" element={<Home />}/>
        <Route path="lottery/:id" element={<Lottery />}/>
        <Route path="/dev/access/admin/swyrbsvwindganwtqpehsb" element={<Admin />}/>
        <Route path="*" element={<NotFound />}/>
      </Route>
    )
  );

  return (
    <>
    <RouterProvider router={router} />
    <Toaster/>
    </>
  );
};

export default App;
