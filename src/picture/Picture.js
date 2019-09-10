import React, { Component } from "react";
import { Card } from "semantic-ui-react";
import {  S3Image } from "aws-amplify-react";
import "semantic-ui-css/semantic.min.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { API, graphqlOperation } from "aws-amplify";
import "../picture/Picture.css";

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



// Get all positive sentiment components for a photo
const GetPositiveSentiments = `query searchComments($id: ID!) {
  searchComments(limit: 100, filter: { commentPhotoId: { eq: $id }}) {
    items {
      text
      Sentiment
      SentimentScorePositive
      SentimentScoreNeutral
      commentPhotoId
      }
    }
  }`;

	const SubscribeOnCreateComment = `
	subscription OnCreateComment($photoId: ID){
		onCreateComment(commentPhotoId: $photoId){
			id
			commentPhotoId
		}
	}
	`;


export default class Picture extends Component {
  constructor(props) {
    super(props);
    this.state = {
      status: false,
      photoId: this.props.id,
			count: 0,
			positivity: -1
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
    console.log(
      "Picture.js handlePhotoClick:::" + id + " Photo ID " + this.photoId
    );
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
    console.log("this is:", this);
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

	async getSentiment() {
    const result = await API.graphql(
      graphqlOperation(GetPositiveSentiments, {
        id: this.props.id
       })
		 );
		this.state.positivity = -1;
		if (result.data.searchComments.items.length !== 0) {
      var sentiments = result.data.searchComments.items;
			var positiveSentiments = sentiments.filter(a => a.Sentiment === "POSITIVE");
			this.setState({ positivity:  positiveSentiments.length/sentiments.length});
			console.log(
				  "Positivity level for this design ", this.state.positivity,
					"number of sentiments", sentiments.length,
					"number of positive sentimenst", positiveSentiments.length);
		}
	}

  async getScore() {
    const result = await API.graphql(
      graphqlOperation(GetPhoto, {
        id: this.props.id
      })
		);
		this.setState({ count: result.data.getPhoto.score });
		console.log("The latest score in Picture ", result);

		API.graphql(
			graphqlOperation(SubscribeOnCreateComment,{photoId: this.props.id})).
			subscribe({
				next: (data) => {
					//console.log('SUBSCRIPTION =', data);
					this.getSentiment();
			}
			});
	}

  handleIncrement = async _product => {
    const result = await API.graphql(
      graphqlOperation(UpdatePhoto, {
        id: this.props.id,
        score: this.state.count + 1
      })
    );

    //console.log("Increment Clicked", result.data.updatePhoto.score);
    this.setState({ count: result.data.updatePhoto.score });
    //console.log("After update the score in DB" + result.data.updatePhoto.score);
  };
  render() {
		this.state.count === 0 ? this.getScore() : void 0;
		this.state.positivity === -1 ? this.getSentiment(): void 0;
    return (

      <Card>
        <div
          onClick={() => this.props.removeImage(this.props.id)}
          className="delete"
        >
          <FontAwesomeIcon icon={faTimesCircle} size="2x" />
        </div>
        <S3Image
          key={this.props.key}
          alt="Nail sample i3"
          imgKey={this.props.cover}
          onClick={() => this.handleClick(this.props.cover)}
          style={{ width: 130 + "px", height: 175 + "px" }}
        />
        <Card.Content>
          <Card.Header>
            <label>Click to comment</label>
          </Card.Header>
        </Card.Content>
        <Card.Content extra>
          <div className="count">
            <span style={this.styles} className={this.getBadgeClasses()}>
              {this.formatCount()}
            </span>
            <button
              onClick={() => this.handleIncrement({})}
              className="likeButton"
            >
              <label>Press it if you like it</label>
            </button>
          </div>
        </Card.Content>
      </Card>
    );
  }
}
