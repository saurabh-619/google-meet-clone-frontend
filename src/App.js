import "./App.scss";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Callpage from "./components/CallPage/CallPage";
import HomePage from "./components/HomePage/HomePage";
import NoMatch from "./components/NoMatch/NoMatch";

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/:id" component={Callpage} />
        <Route exact path="/" component={HomePage} />
        <Route exact path="*" component={NoMatch} />
      </Switch>
    </Router>
  );
}

export default App;
