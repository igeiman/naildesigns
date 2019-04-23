import React, { Component } from "react";
import { Form, TextArea, Label } from "semantic-ui-react";
import { Space } from "aws-amplify-react/dist/AmplifyTheme";

class Counter extends Component {
  state = {
    count: 0,
    textareaValue: "",
    images: ["image1", "image2", "image3"]
  };
  styles = {
    fontSize: 20,
    fontWeight: "bold"
  };

  handleIncrement = product => {
    console.log("Increment Clicked", this);
    console.log("Increment Clicked", this);
    this.setState({ count: this.state.count + 1 });
  };
  handleOnChange(event) {
    this.setState({
      textareaValue: event.target.value
    });
  }
  renderImages() {
    if (this.state.images.length === 0) return <p>There are no images'</p>;
    else
      return (
        <ul>
          {this.state.images.map(tag => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      );
  }
  render() {
    return (
      <React.Fragment>
        <Form>
          <Label>Tell us more</Label>
          <br />
          <TextArea
            placeholder="Comments"
            style={{ minHeight: 100, width: 350 }}
            value={this.state.textareaValue}
            onChange={event => this.handleOnChange(event)}
          />
        </Form>

        <span style={this.styles} className={this.getBadgeClasses()}>
          {this.formatCount()}
        </span>
        <button
          onClick={() => this.handleIncrement({})}
          className="btn btn-secondary btn-sm"
        >
          Increment
        </button>
      </React.Fragment>
    );
  }
  getBadgeClasses() {
    let classes = "badge m-2 badge-";
    classes += this.state.count === 0 ? "warning" : "primary";
    return classes;
  }

  formatCount() {
    const { count } = this.state;
    return count === 0 ? "Zero" : count;
  }
}

export default Counter;
