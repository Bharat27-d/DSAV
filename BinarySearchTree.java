class Node {
    int data;
    Node left, right;

    public Node(int value) {
        data = value;
        left = right = null;
    }
}

public class BinarySearchTree {
    Node root;

    BinarySearchTree() {
        root = null;
    }

    void insert(int value) {
        root = insertRec(root, value);
    }

    Node insertRec(Node root, int value) {
        if (root == null) {
            root = new Node(value);
            return root;
        }
        if (value < root.data)
            root.left = insertRec(root.left, value);
        else if (value > root.data)
            root.right = insertRec(root.right, value);
        return root;
    }

    boolean search(int value) {
        return searchRec(root, value);
    }

    boolean searchRec(Node root, int value) {
        if (root == null)
            return false;
        if (root.data == value)
            return true;
        return value < root.data ? searchRec(root.left, value) : searchRec(root.right, value);
    }

    void delete(int value) {
        root = deleteRec(root, value);
    }

    Node deleteRec(Node root, int value) {
        if (root == null)
            return root;
        if (value < root.data)
            root.left = deleteRec(root.left, value);
        else if (value > root.data)
            root.right = deleteRec(root.right, value);
        else {
            if (root.left == null && root.right == null)
                return null;
            else if (root.left == null)
                return root.right;
            else if (root.right == null)
                return root.left;
            root.data = minValue(root.right);
            root.right = deleteRec(root.right, root.data);
        }
        return root;
    }

    int minValue(Node root) {
        int minv = root.data;
        while (root.left != null) {
            minv = root.left.data;
            root = root.left;
        }
        return minv;
    }

    void inorder() {
        inorderRec(root);
        System.out.println();
    }

    void inorderRec(Node root) {
        if (root != null) {
            inorderRec(root.left);
            System.out.print(root.data + " ");
            inorderRec(root.right);
        }
    }

    void preorder() {
        preorderRec(root);
        System.out.println();
    }

    void preorderRec(Node root) {
        if (root != null) {
            System.out.print(root.data + " ");
            preorderRec(root.left);
            preorderRec(root.right);
        }
    }

    void postorder() {
        postorderRec(root);
        System.out.println();
    }

    void postorderRec(Node root) {
        if (root != null) {
            postorderRec(root.left);
            postorderRec(root.right);
            System.out.print(root.data + " ");
        }
    }

    public static void main(String[] args) {
        BinarySearchTree bst = new BinarySearchTree();
        // populate tree using explicit insert calls (for-each removed)
        bst.insert(10);
        bst.insert(15);
        bst.insert(21);
        bst.insert(30);
        bst.insert(18);
        bst.insert(19);

        System.out.println("Inorder traversal:");
        bst.inorder();

        System.out.println("Preorder traversal:");
        bst.preorder();

        System.out.println("Postorder traversal:");
        bst.postorder();

        System.out.println("\nSearch 18: " + bst.search(18));
        System.out.println("Search 25: " + bst.search(25));

        System.out.println("\nDeleting 21...");
        bst.delete(21);
        System.out.println("Inorder after deletion:");
        bst.inorder();

        System.out.println("Deleting 10...");
        bst.delete(10);
        System.out.println("Inorder after deletion:");
        bst.inorder();
    }
}
