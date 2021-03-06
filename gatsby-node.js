const path = require("path")
const slugify = require("@sindresorhus/slugify")
const { createFilePath } = require("gatsby-source-filesystem")
const { format } = require("date-fns")
const _ = require("lodash")

const PAGINATION_OFFSET = 7

const createPosts = (createPage, createRedirect, edges) => {
  edges.forEach(({ node }, i) => {
    const prev = i === 0 ? null : edges[i - 1].node
    const next = i === edges.length - 1 ? null : edges[i + 1].node
    const pagePath = node.fields.slug

    if (node.fields.redirects) {
      node.fields.redirects.forEach(fromPath => {
        createRedirect({
          fromPath,
          toPath: pagePath,
          redirectInBrowser: true,
          isPermanent: true,
        })
      })
    }

    createPage({
      path: pagePath,
      component: path.resolve("./src/templates/post.js"),
      context: {
        id: node.id,
        prev,
        next,
      },
    })
  })
}

function createBlogPages({ blogPath, data, paginationTemplate, actions }) {
  if (_.isEmpty(data.edges)) {
    throw new Error("There are no posts!")
  }

  const { edges } = data
  const { createRedirect, createPage } = actions
  createPosts(createPage, createRedirect, edges)
  createPaginatedPages(
    actions.createPage,
    edges,
    blogPath,
    paginationTemplate,
    {
      categories: [],
    },
  )
  return null
}

function createTagPages({ tagPath, data, paginationTemplate, actions }) {
  if (_.isEmpty(data.edges)) {
    throw new Error("There are no posts!")
  }

  const { createPage } = actions
  const { edges } = data

  // Tag pages:
  let tags = []
  // Iterate through each post, putting all found tags into `tags`
  _.each(edges, edge => {
    if (_.get(edge, "node.frontmatter.tags")) {
      tags = tags.concat(edge.node.frontmatter.tags)
    }
  })
  // Eliminate duplicate tags
  tags = _.uniq(tags)

  // Make tag pages
  tags.forEach(tag => {
    createPage({
      path: `${tagPath}/${_.kebabCase(tag)}/`,
      component: paginationTemplate,
      context: {
        tag,
      },
    })
  })

  return null
}

// eslint-disable-next-line consistent-return
exports.createPages = async ({ actions, graphql }) => {
  const { data, errors } = await graphql(`
    fragment PostDetails on Mdx {
      fileAbsolutePath
      id
      parent {
        ... on File {
          name
          sourceInstanceName
        }
      }
      excerpt(pruneLength: 250)
      fields {
        title
        slug
        description
        date
      }
      code {
        scope
      }
      frontmatter {
        tags
      }
    }

    query {
      blog: allMdx(
        filter: {
          frontmatter: {published: {ne: false}}
          fileAbsolutePath: {regex: "//content/blog//"}
        }
        sort: {order: DESC, fields: [frontmatter___date]}
      ) {
        edges {
          node {
            ...PostDetails
          }          
        }
      }
    }
  `)

  if (errors) {
    return Promise.reject(errors)
  }

  const { blog } = data

  createBlogPages({
    blogPath: "/blog",
    data: blog,
    paginationTemplate: path.resolve("src/templates/blog.js"),
    actions,
  })

  createTagPages({
    tagPath: "/tags",
    data: blog,
    paginationTemplate: path.resolve("src/templates/tags.js"),
    actions,
  })

}

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    resolve: {
      modules: [path.resolve(__dirname, "src"), "node_modules"],
      alias: {
        $components: path.resolve(__dirname, "src/components"),
      },
    },
  })
}

function createPaginatedPages(
  createPage,
  edges,
  pathPrefix,
  paginationTemplate,
  context,
) {
  const pages = edges.reduce((acc, value, index) => {
    const pageIndex = Math.floor(index / PAGINATION_OFFSET)

    if (!acc[pageIndex]) {
      acc[pageIndex] = []
    }

    acc[pageIndex].push(value.node.id)

    return acc
  }, [])

  pages.forEach((page, index) => {
    const previousPagePath = `${pathPrefix}/${index + 1}`
    const nextPagePath = index === 1 ? pathPrefix : `${pathPrefix}/${index - 1}`

    createPage({
      path: index > 0 ? `${pathPrefix}/${index}` : `${pathPrefix}`,
      component: paginationTemplate,
      context: {
        pagination: {
          page,
          nextPagePath: index === 0 ? null : nextPagePath,
          previousPagePath:
            index === pages.length - 1 ? null : previousPagePath,
          pageCount: pages.length,
          pathPrefix,
        },
        ...context,
      },
    })
  })
}

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions

  if (node.internal.type === "Mdx") {
    const parent = getNode(node.parent)
    let slug =
      node.frontmatter.slug ||
      createFilePath({ node, getNode, basePath: "pages" })

    if (node.fileAbsolutePath.includes("content/blog/")) {
      const permalink = node.frontmatter.date && node.frontmatter.slug
        ?
        `${format(node.frontmatter.date, "YYYY-MM-DD")}-${node.frontmatter.slug}`
        :
        slugify(parent.name)
      slug = `/blog/${permalink}`
    }

    createNodeField({
      name: "id",
      node,
      value: node.id,
    })

    createNodeField({
      name: "published",
      node,
      value: node.frontmatter.published,
    })

    createNodeField({
      name: "title",
      node,
      value: node.frontmatter.title,
    })

    createNodeField({
      name: "author",
      node,
      value: node.frontmatter.author || "Torsten Uhlmann",
    })

    createNodeField({
      name: "description",
      node,
      value: node.frontmatter.description,
    })

    createNodeField({
      name: "slug",
      node,
      value: slug,
    })

    createNodeField({
      name: "date",
      node,
      value: node.frontmatter.date ? node.frontmatter.date.split(" ")[0] : "",
    })

    createNodeField({
      name: "banner",
      node,
      value: node.frontmatter.banner,
    })

    createNodeField({
      name: "bannerCredit",
      node,
      value: node.frontmatter.bannerCredit,
    })

    createNodeField({
      name: "categories",
      node,
      value: node.frontmatter.categories || [],
    })

    createNodeField({
      name: "tags",
      node,
      value: node.frontmatter.tags || [],
    })

    createNodeField({
      name: "redirects",
      node,
      value: node.frontmatter.redirects,
    })

    createNodeField({
      name: "editLink",
      node,
      value: `https://github.com/tuhlmann/agynamix.de/edit/master${node.fileAbsolutePath.replace(
        __dirname,
        "",
      )}`,
    })

    createNodeField({
      name: "noFooter",
      node,
      value: node.frontmatter.noFooter || false,
    })
  }
}