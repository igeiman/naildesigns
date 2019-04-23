import React, { Component } from "react";
import { Card, Icon, Image } from "semantic-ui-react";
import { Connect, S3Image, withAuthenticator } from "aws-amplify-react";
import "semantic-ui-css/semantic.min.css";

export default class Picture extends Component {
  constructor(props) {
    super(props);
    this.state = {
      status: false,
      id: this.props.id
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleClick = this.handlePhotoClick.bind(this);
    this.updateLibraryCount = this.updateLibraryCount.bind(this);
    this.updateState = this.updateState.bind(this);
  }

  updateState(id) {
    console.log("updateState:::" + id);
    this.props.handlePhotoClick(id);
  }
  handlePhotoClick(id) {
    console.log("handlePhotoClick:::" + id);
    this.updateState(id);
    //this.setState(this.updateState(id));
  }
  updateLibraryCount() {
    console.log(this.state);
    this.props.handleCounter(this.state);
  }

  handleChange() {
    this.setState({ status: !this.state.status }, this.updateLibraryCount);
  }
  handleClick() {
    console.log("this is:");
    console.log("this is:", this);
  }

  render() {
    return (
      <Card>
        <S3Image
          key={this.props.key}
          alt="Nail sample i3"
          imgKey={this.props.cover}
          onClick={() => this.handleClick(this.props.cover)}
          style={{ width: 230 + "px", height: 325 + "px" }}
        />

        <Card.Content>
          <Card.Header>{this.props.name}</Card.Header>
          <Card.Meta>
            <span className="date" />
          </Card.Meta>
          <Card.Description>
            Made By {this.props.author}
            <br />
            <Icon name="book" />
            {this.props.isbn}
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className="ui checkbox">
            <input
              type="checkbox"
              name="example"
              onChange={this.handleChange}
            />
            <label>Do you like it?</label>
          </div>
        </Card.Content>
      </Card>
    );
  }
}
