// src/App.js

import React, { Component } from "react";
import Counter from "./counter/Counter";
import Picture from "./picture/Picture";
import { Card, CardContent, CardGroup } from "semantic-ui-react";

import { BrowserRouter as Router, Route, NavLink } from "react-router-dom";
import "./App.css";
import "./library/Library.css";
import {
  Container,
  Divider,
  Form,
  Grid,
  Header,
  Input,
  List,
  Modal,
  Image,
  Segment,
  Label
} from "semantic-ui-react";
import { v4 as uuid } from "uuid";

import { Connect, S3Image, withAuthenticator } from "aws-amplify-react";
import Amplify, { API, graphqlOperation, Storage } from "aws-amplify";

import aws_exports from "./aws-exports";

Amplify.configure(aws_exports);

function makeComparator(key, order = "asc") {
  return (a, b) => {
    if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) return 0;

    const aVal = typeof a[key] === "string" ? a[key].toUpperCase() : a[key];
    const bVal = typeof b[key] === "string" ? b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (aVal > bVal) comparison = 1;
    if (aVal < bVal) comparison = -1;

    return order === "desc" ? comparison * -1 : comparison;
  };
}

const UploadPhoto = `
mutation UploadPhoto($albumId:ID!, $action: String)
{
	uploadPhoto(albumId: $albumId, action: $action)
	{
    id
    bucket
  }
}`;

const DeletePhoto = `mutation DeletePhoto($id: ID!){
  deletePhoto(input:{id: $id})
 {
   id
   bucket
 }
}`;

const ListAlbums = `query ListAlbums {
  listAlbums(limit: 9999) {
      items {
          id
					name
					description
      }
  }
}`;

const SubscribeToUploadDeletePhoto = `
subscription OnPhotoUploadDelete{
  onPhotoUploadDelete{
    id
    bucket
  }
}
`;

const SubscribeToNewAlbums = `
  subscription OnCreateAlbum {
    onCreateAlbum {
      id
      name
    }
  }
`;

const GetAlbum = `query GetAlbum($id: ID!, $nextTokenForPhotos: String) {
    getAlbum(id: $id) {
    id
    name
    photos(sortDirection: DESC, nextToken: $nextTokenForPhotos) {
      nextToken
      items {
        id
        score
        thumbnail {
          width
          height
          key
        }
        fullsize {
          width
          height
          key
        }
      }
    }
  }
}
`;

const SearchPhotos = `query SearchPhotos($label: String!) {
  searchPhotos(filter: { labels: { match: $label }}) {
    items {
      id
      bucket
      thumbnail {
          key
          width
          height
      }
      fullsize {
          key
          width
          height
      }
    }
  }
}`;

// Photoid:45b85edd-7420-4ab1-9135-7172770fee1c
class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      photos: [],
      album: null,
      label: "",
      hasResults: false,
      searched: false
    };
  }

  updateLabel = e => {
    this.setState({ label: e.target.value, searched: false });
  };

  getPhotosForLabel = async () => {
    const result = await API.graphql(
      graphqlOperation(SearchPhotos, { label: this.state.label })
    );
    let photos = [];
    let label = "";
    let hasResults = false;
    if (result.data.searchPhotos.items.length !== 0) {
      hasResults = true;
      photos = result.data.searchPhotos.items;
      label = this.state.label;
    }
    const searchResults = { label, photos };
    this.setState({ searchResults, hasResults, searched: true });
  };

  noResults() {
    return !this.state.searched ? (
      ""
    ) : (
      <Header as="h4" color="grey">
        No photos found matching '{this.state.label}'
      </Header>
    );
  }

  render() {
    return (
      <Segment>
        <Input
          type="text"
          placeholder="Search for photos"
          icon="search"
          iconPosition="left"
          action={{ content: "Search", onClick: this.getPhotosForLabel }}
          name="label"
          value={this.state.label}
          onChange={this.updateLabel}
        />
        {this.state.hasResults ? (
          <PhotosList photos={this.state.searchResults.photos} />
        ) : (
          this.noResults()
        )}
      </Segment>
    );
  }
}

class S3ImageUpload extends React.Component {
  constructor(props) {
    super(props);
    this.state = { file: "", imagePreviewUrl: "", uploading: false };
  }

  uploadFile = async file => {
    const fileName = uuid();

    const result = await Storage.put(fileName, file, {
      customPrefix: { public: "uploads/" },
      metadata: { albumid: this.props.albumId }
    });
    console.log("Triggering mutation for photo ", fileName);
    await API.graphql(
      graphqlOperation(UploadPhoto, {
        albumId: this.props.albumId,
        action: "PhotoUploaded"
      })
    );
  };

  onChange = async e => {
    this.setState({ uploading: true });

    let files = [];
    for (var i = 0; i < e.target.files.length; i++) {
      files.push(e.target.files.item(i));
    }
    await Promise.all(files.map(f => this.uploadFile(f)));

    this.setState({ uploading: false });
  };
  _handleSubmit(e) {
    e.preventDefault();
    // TODO: do something with -> this.state.file
    console.log("handle uploading-" + this.gestate.imagePreviewUrl);
  }
  _handleImageChange(e) {
    e.preventDefault();

    let reader = new FileReader();
    let file = e.target.files[0];

    reader.onloadend = () => {
      this.setState({
        file: file,
        imagePreviewUrl: reader.result
      });
    };

    reader.readAsDataURL(file);
  }
  render() {
    return (
      <div>
        <Form.Button
          onClick={() =>
            document.getElementById("add-image-file-input").click()
          }
          disabled={this.state.uploading}
          icon="file image outline"
          content={this.state.uploading ? "Uploading..." : "Add Images"}
        />
        <input
          id="add-image-file-input"
          type="file"
          accept="image/*"
          multiple
          className="orangeButton"
          onChange={this.onChange}
          style={{ display: "none" }}
        />
      </div>
    );
  }
}

class PhotosList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPhoto: null
    };
    this.photoClick = this.photoClick.bind(this);
    this.handlePhotoClick = this.handlePhotoClick.bind(this);
    this.removeImage = this.removeImage.bind(this);
  }

  async removeImage(id) {
    const result = await API.graphql(
      graphqlOperation(DeletePhoto, {
        id: id
      })
    );
    // this
    let items = this.props.photos;
    console.log("REMOVE IMAGE::" + id + items.size);
  }
  removeImageOld = id => {
    this.setState({});
  };

  handlePhotoClick(id) {
    let items = this.props.photos;
    console.log("photoClick photoClick:SIZE" + items.map.size);
    items.map(photo =>
      photo.thumbnail.key.replace("public/", "") === id
        ? this.setState({
            selectedPhoto: photo
          })
        : console.log(
            photo.thumbnail.key +
              "::hhhhhhhhhhhhhhhhhmo::" +
              id +
              (photo.thumbnail.key === id)
          )
    );
  }

  handleLightboxClose = () => {
    console.log(
      "Closing the picture with handleLightboxClose " +
        this.state.selectedPhoto.id
    );
    this.setState({
      selectedPhoto: null
    });
  };

  photoClick = photo => {
    console.log("photoClick photoClick:" + photo);
    this.setState({
      selectedPhoto: photo
    });
  };

  handleCounter(_State) {
    console.log("handle counter:" + _State);
    //const ObjNum = this.state.selectedPhoto.findIndex(
    //   _book => _book.isbn === _State.id
    // );
  }
  photoItems() {
    return (
      <div className="flex-row-container">
        {this.props.photos.map(photo => (
          <Picture
            handleCounter={this.handleCounter}
            handlePhotoClick={this.handlePhotoClick}
            key={photo.thumbnail.key}
            cover={photo.thumbnail.key.replace("public/", "")}
            size={photo.fullsize}
            author="Author"
            name="Name"
            removeImage={this.removeImage}
            id={photo.id}
          />
        ))}
      </div>
    );
  }

  render() {
    return (
      <div>
        <Divider hidden />

        {this.photoItems()}

        <Lightbox
          photo={this.state.selectedPhoto}
          onClose={this.handleLightboxClose}
        />
      </div>
    );
  }
}

class NewAlbum extends Component {
  constructor(props) {
    super(props);
    this.state = {
      albumName: ""
    };
  }

  handleChange = event => {
    let change = {};
    change[event.target.name] = event.target.value;
    this.setState(change);
  };

  handleSubmit = async event => {
    event.preventDefault();
    const NewAlbum = `mutation NewAlbum($name: String!) {
      createAlbum(input: {name: $name}) {
        id
        name
      }
    }`;

    const result = await API.graphql(
      graphqlOperation(NewAlbum, { name: this.state.albumName })
    );
    console.info(`Created album with id ${result.data.createAlbum.id}`);
    this.setState({ albumName: "" });
  };

  render() {
    return (
      <Segment>
        <Header as="h3">Add a new album</Header>
        <Input
          type="text"
          placeholder="New Album Name"
          icon="plus"
          iconPosition="left"
          className="orangeButton"
          action={{ content: "Create", onClick: this.handleSubmit }}
          name="albumName"
          value={this.state.albumName}
          onChange={this.handleChange}
        />
      </Segment>
    );
  }
}

class Lightbox extends Component {
  render() {
    return (
      <Modal open={this.props.photo !== null} onClose={this.props.onClose}>
        <Modal.Content>
          <Container textAlign="center">
            {this.props.photo ? (
              <div>
                <Label>Hello</Label>

                <S3Image
                  className="resizeImg"
                  imgKey={this.props.photo.fullsize.key.replace("public/", "")}
                  style={{
                    width: "500px !important",
                    height: "400px !important"
                  }}
                  theme={{
                    photoImg: {
                      maxWidth: "500px",
                      height: "400px !important",
                      width: "500px !important"
                    }
                  }}
                  onClick={this.props.onClose}
                />
                <Counter photoId={this.props.photo.id} />
              </div>
            ) : null}
          </Container>
        </Modal.Content>
      </Modal>
    );
  }
}

class AlbumsList extends React.Component {
  albumItems() {
    return this.props.albums.sort(makeComparator("name")).map(album => (
      <Card key={album.id} className="albumCard">
        <Image
          avatar
          src="https://react.semantic-ui.com/images/avatar/small/lena.png"
        />
        <Card.Content>
          <Card.Header>
            <NavLink to={`/albums/${album.id}`}>{album.name}</NavLink>
          </Card.Header>

          <Card.Description>{album.description}</Card.Description>
        </Card.Content>
      </Card>
    ));
  }

  render() {
    return (
      <Segment>
        <Header as="h3">My Albums</Header>
        <Container className="containerAlbum" text style={{ marginTop: "2em" }}>
          <Card.Group>{this.albumItems()}</Card.Group>
        </Container>
      </Segment>
    );
  }
}

class AlbumDetailsLoader extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      nextTokenForPhotos: null,
      hasMorePhotos: true,
      album: null,
      loading: true
    };
  }

  onCreateOrDeletePhoto = async (prevQuery, newData) => {
    // When we get notified about the delete we need to update the state
    // and remove the deleted photo from the list of photos
    const sleep = seconds =>
      new Promise(resolve => setTimeout(resolve, seconds * 1000));
    if (
      newData.onPhotoUploadDelete.bucket === "PhotoUploaded" &&
      this.state.album.id === newData.onPhotoUploadDelete.id
    ) {
      console.log(
        "CONGRATS! There was an upload for album: ",
        newData.onPhotoUploadDelete.id,
        "Current album: ",
        this.state.album.id
      );

      await sleep(8);
      this.state.hasMorePhotos = true;
      this.state.nextTokenForPhotos = null;
      this.state.album = null;
      this.loadMorePhotos();
      return;
    }
    var index = this.state.album.photos.items.findIndex(
      element => element.id === newData.onPhotoUploadDelete.id
    );
    if (typeof index == "undefined") return;
    this.state.album.photos.items.splice(index, 1);
  };

  async loadMorePhotos() {
    if (!this.state.hasMorePhotos) return;

    this.setState({ loading: true });
    const { data } = await API.graphql(
      graphqlOperation(GetAlbum, {
        id: this.props.id,
        nextTokenForPhotos: this.state.nextTokenForPhotos
      })
    );
    console.log("IN loadMorePhotos, query results ", JSON.stringify(data));

    let album;
    if (this.state.album === null) {
      album = data.getAlbum;
    } else {
      album = this.state.album;
      album.photos.items = album.photos.items.concat(
        data.getAlbum.photos.items
      );
    }
    this.setState({
      album: album,
      loading: false,
      nextTokenForPhotos: data.getAlbum.photos.nextToken,
      hasMorePhotos: data.getAlbum.photos.nextToken !== null
    });
    console.log("PhotosLoader " + JSON.stringify(album));
  }

  componentDidMount() {
    this.loadMorePhotos();
  }

  render() {
    return (
      <Connect
        query={graphqlOperation(GetAlbum)}
        subscription={graphqlOperation(SubscribeToUploadDeletePhoto)}
        onSubscriptionMsg={this.onCreateOrDeletePhoto}
      >
        {({ data }) => {
          console.log("In Connect , the data is ", JSON.stringify(data));
          return (
            <AlbumDetails
              loadingPhotos={this.state.loading}
              album={this.state.album}
              loadMorePhotos={this.loadMorePhotos.bind(this)}
              hasMorePhotos={this.state.hasMorePhotos}
            />
          );
        }}
      </Connect>
    );
  }
}

class AlbumDetails extends Component {
  render() {
    if (!this.props.album) return "Loading album...";

    return (
      <Segment>
        <Header as="h3">{this.props.album.name}</Header>
        <S3ImageUpload albumId={this.props.album.id} />
        <PhotosList photos={this.props.album.photos.items} />
        {this.props.hasMorePhotos && (
          <Form.Button
            onClick={this.props.loadMorePhotos}
            icon="refresh"
            disabled={this.props.loadingPhotos}
            content={
              this.props.loadingPhotos ? "Loading..." : "Load more photos"
            }
          />
        )}
      </Segment>
    );
  }
}

class AlbumsListLoader extends React.Component {
  onNewAlbum = (prevQuery, newData) => {
    // When we get data about a new album, we need to put in into an object
    // with the same shape as the original query results, but with the new data added as well
    let updatedQuery = Object.assign({}, prevQuery);
    updatedQuery.listAlbums.items = prevQuery.listAlbums.items.concat([
      newData.onCreateAlbum
    ]);
    return updatedQuery;
  };

  render() {
    return (
      <Connect
        query={graphqlOperation(ListAlbums)}
        subscription={graphqlOperation(SubscribeToNewAlbums)}
        onSubscriptionMsg={this.onNewAlbum}
      >
        {({ data, loading }) => {
          if (loading) {
            return <div>Loading Now...</div>;
          }
          if (!data.listAlbums) return;

          return <AlbumsList albums={data.listAlbums.items} />;
        }}
      </Connect>
    );
  }
}

class App extends Component {
  render() {
    return (
      <Router>
        <Grid padded className="gridUI">
          <Grid.Column className="columnAlbum">
            <Route path="/" exact component={NewAlbum} />
            <Route path="/" exact component={AlbumsListLoader} />
            <Route path="/" exact component={Search} />
          </Grid.Column>
        </Grid>
        <Grid padded className="gridUI">
          <Grid.Column>
            <Route
              className="columnPhoto"
              path="/albums/:albumId"
              render={() => (
                <div>
                  <NavLink to="/"><h3>Back to Albums list</h3></NavLink>
                </div>
              )}
            />
            <Route
              className="columnPhoto"
              path="/albums/:albumId"
              render={props => (
                <AlbumDetailsLoader id={props.match.params.albumId} />
              )}
            />
          </Grid.Column>
        </Grid>
      </Router>
    );
  }
}

export default withAuthenticator(App, { includeGreetings: true });
