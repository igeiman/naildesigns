import React, { Component } from "react";
import { Form, TextArea, Label } from "semantic-ui-react";
import { Space } from "aws-amplify-react/dist/AmplifyTheme";
import Amplify, { API, graphqlOperation, Storage } from "aws-amplify";

const UpdatePhoto = `mutation UpdatePhoto($id: ID!, $score: Int) {
	updatePhoto(input:{id: $id, score: $score}){
  	id
    score
	}
}`;

const GetPhoto = `query GetPhoto($id: ID!) {
	getPhoto(id: $id){
  	id
    score
	}
}`;

const CreateComment = `mutation CreateComment($text: String!, $commentPhotoId: ID!) {
	createComment(input:{text: $text, commentPhotoId: $commentPhotoId}){
  	id
		text
		commentPhotoId
	}
}`;

class Counter extends Component {
  constructor(props) {
    super(props);
    this.state = {
      count: 0,
      albumName: "",
      textAreaValue: ""
    };
  }

  styles = {
    fontSize: 20,
    fontWeight: "bold"
  };

  handleIncrement = async _product => {
    const result = await API.graphql(
      graphqlOperation(UpdatePhoto, {
        id: this.props.photoId,
        score: this.state.count + 1
      })
    );
    this.setState({ count: result.data.updatePhoto.score });
    console.log("Increment Clicked", this);
    console.log("After update the score in DB" + result.data.updatePhoto.score);
  };
  handleOnChange(event) {
    this.setState({
      textAreaValue: event.target.value
    });
  }
  renderImages() {
    if (this.state.images.length === 0) return <p>There are no images'</p>;
    else
      return (
        <ul style="width:10">
          {this.state.images.map(tag => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      );
  }

  async getScore() {
    const result = await API.graphql(
      graphqlOperation(GetPhoto, {
        id: this.props.photoId
      })
    );
    console.log("Getting the latest score ", result);
    this.setState({ count: result.data.getPhoto.score });
  }

  async componentWillUnmount() {
    const result = await API.graphql(
      graphqlOperation(CreateComment, {
        text: this.state.textAreaValue,
        commentPhotoId: this.props.photoId
      })
    );
    console.log(
      "That's what we have in the comments ",
      this.state.textAreaValue
    );
    console.log("Result is ", result);
  }

  render() {
    this.state.count === 0 ? this.getScore() : void 0;
    return (
      <React.Fragment>
        <Form>
          <Label>Tell us more</Label>
          <br />
          <TextArea
            placeholder="Comments"
            style={{ minHeight: 100, width: 350 }}
            value={this.state.textAreaValue}
            onChange={event => this.handleOnChange(event)}
          />
        </Form>
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
