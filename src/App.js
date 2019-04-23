// src/App.js

import React, { Component } from "react";
import Counter from "./counter/Counter";
import Picture from "./picture/Picture";
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

const ListAlbums = `query ListAlbums {
    listAlbums(limit: 9999) {
        items {
            id
            name
        }
    }
}`;

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

  getPhotosForLabel = async e => {
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
    this.state = { uploading: false };
  }

  uploadFile = async file => {
    const fileName = uuid();

    const result = await Storage.put(fileName, file, {
      customPrefix: { public: "uploads/" },
      metadata: { albumid: this.props.albumId }
    });

    console.log("Uploaded file: ", result);
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
  }

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
    //this.setState({
    // selectedPhoto: id
    //});
  }
  handlePhotoClickOld(id) {
    console.log("handlePhotoClick photoClick: " + id);
    let ObjNum = this.props.photos.find(photo => photo.thumbnail.key === id);
    let items = this.props.photos;
    //{
    //items.map(photo => console.log(id + "VALUE::" + photo.thumbnail.key));
    //}
    // console.log("handlePhotoClick photoClick: " + photo.thumbnail.key);
    //photo.thumbnail.key = "public/" + photo.thumbnail.key;
    //return photo;
    // }
    //});

    this.setState({
      selectedPhoto: ObjNum
    });
    console.log("SELECTEDkkkk::" + this.state.selectedPhoto);
  }

  handleLightboxClose = () => {
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
    console.log("handel counter:" + _State);
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
                  imgKey={this.props.photo.thumbnail.key.replace("public/", "")}
                  theme={{
                    photoImg: {
                      maxWidth: "500px",
                      height: "400px",
                      width: "500px"
                    }
                  }}
                  onClick={this.props.onClose}
                />
                <Counter />
              </div>
            ) : null}
          </Container>
        </Modal.Content>
      </Modal>
    );
  }
}

class LightboxRita extends Component {
  render() {
    return (
      <Modal open={this.props.photo !== null} onClose={this.props.onClose}>
        <Modal.Content>
          <Container textAlign="center">
            {this.props.photo ? (
              <div>
                <S3Image
                  imgKey={this.props.photo.key.replace("public/", "")}
                  theme={{
                    photoImg: { maxWidth: "50%", height: "50%", width: "50%" }
                  }}
                  onClick={this.props.onClose}
                />
                <Counter />
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
      <List.Item key={album.id}>
        <NavLink to={`/albums/${album.id}`}>{album.name}</NavLink>
      </List.Item>
    ));
  }

  render() {
    return (
      <Segment>
        <Header as="h3">My Albums</Header>
        <List divided relaxed>
          {this.albumItems()}
        </List>
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

  async loadMorePhotos() {
    if (!this.state.hasMorePhotos) return;

    this.setState({ loading: true });
    const { data } = await API.graphql(
      graphqlOperation(GetAlbum, {
        id: this.props.id,
        nextTokenForPhotos: this.state.nextTokenForPhotos
      })
    );

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
  }

  componentDidMount() {
    this.loadMorePhotos();
  }

  render() {
    return (
      <AlbumDetails
        loadingPhotos={this.state.loading}
        album={this.state.album}
        loadMorePhotos={this.loadMorePhotos.bind(this)}
        hasMorePhotos={this.state.hasMorePhotos}
      />
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
            return <div>Loading...</div>;
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
        <Grid padded>
          <Grid.Column>
            <Route path="/" exact component={NewAlbum} />
            <Route path="/" exact component={AlbumsListLoader} />
            <Route path="/" exact component={Search} />

            <Route
              path="/albums/:albumId"
              render={() => (
                <div>
                  <NavLink to="/">Back to Albums list</NavLink>
                </div>
              )}
            />
            <Route
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
